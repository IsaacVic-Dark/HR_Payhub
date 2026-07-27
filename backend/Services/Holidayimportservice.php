<?php

namespace App\Services;

/**
 * @package HolidayImportService
 *
 * Manual, on-demand sync of public_holidays_master from the Mansa public
 * holidays API, for a given country_code + year.
 *
 * TODO: This is a MANUAL import triggered via
 *       POST /api/v1/holidays/import. Replace with a scheduled cron job
 *       (e.g. run automatically for KE every Jan 1st, and per-country
 *       once other countries are onboarded) once this manual flow has
 *       been verified in production.
 *
 * Never deletes holidays — rows the API stops returning are deactivated
 * (is_active = 0) so payroll history/audit stays intact.
 *
 * @author Generated for PayHub
 */
class HolidayImportService
{
    /**
     * Import/sync holidays for a country + year from Mansa.
     *
     * @return array{
     *   success: bool,
     *   message?: string,
     *   warnings: array<int, string>,
     *   data?: array{country_code:string, year:int, inserted:int, updated:int, deactivated:int}
     * }
     */
    public function import(string $countryCode, int $year): array
    {
        try {
            $rows = $this->fetchFromMansa($countryCode, $year);
        } catch (\Exception $e) {
            error_log("Mansa API import failed for {$countryCode}/{$year}: " . $e->getMessage());
            return [
                'success'  => false,
                'message'  => "Failed to fetch holidays from Mansa API.",
                'warnings' => [],
                // TEMP DEBUG ONLY — remove before shipping, or gate behind
                // an APP_DEBUG env check. Shows the real exception message.
                'debug'    => $e->getMessage(),
            ];
        }

        if (empty($rows)) {
            return [
                'success'  => false,
                'message'  => "Mansa API returned no holidays for {$countryCode}/{$year}.",
                'warnings' => [],
            ];
        }

        // Insert/update/deactivate as one atomic operation so a partial
        // failure never leaves public_holidays_master half-synced.
        return DB::transaction(function () use ($countryCode, $year, $rows) {
            return $this->syncToMaster($countryCode, $year, $rows);
        });
    }

    /**
     * Call the Mansa API for a given country/year and normalize the response.
     *
     * Config (.env):
     *   PUBLIC_HOLIDAYS_API      https://mansaapi.com/api/v1/location/countries/KE/holidays/
     *   PUBLIC_HOLIDAYS_API_KEY
     *
     * NOTE: the .env URL already has "KE" baked into the path. To honor the
     * country_code parameter (for future countries beyond Kenya) we swap
     * the ISO2 segment in that template rather than hardcoding it.
     *
     * Confirmed against Mansa docs / example curl:
     *   - year is a path segment: /holidays/{year} (NOT a ?year= query param)
     *   - auth is a Bearer token in the Authorization header
     *   - response is either `{ "data": [...] }` or a bare array
     *   - each item has date/name/type/id fields (see mapMansaRow below)
     * All of that is isolated here and in mapMansaRow() — a one-place fix.
     *
     * @throws \Exception on missing config, network, or HTTP failure
     */
    private function fetchFromMansa(string $countryCode, int $year): array
    {
        $template = getenv('PUBLIC_HOLIDAYS_API') ?: ($_ENV['PUBLIC_HOLIDAYS_API'] ?? $_SERVER['PUBLIC_HOLIDAYS_API'] ?? null);
        $apiKey   = getenv('PUBLIC_HOLIDAYS_API_KEY') ?: ($_ENV['PUBLIC_HOLIDAYS_API_KEY'] ?? $_SERVER['PUBLIC_HOLIDAYS_API_KEY'] ?? null);

        if (!$template) {
            throw new \Exception("PUBLIC_HOLIDAYS_API is not configured");
        }

        $url = preg_replace('#/countries/[A-Za-z]{2}/#', "/countries/{$countryCode}/", $template);
        $url = rtrim($url, '/') . '/' . $year;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'Authorization: Bearer ' . $apiKey, // TODO: confirm header/scheme with Mansa docs
            ],
        ]);

        $body      = curl_exec($ch);
        $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($body === false || $curlError) {
            throw new \Exception("Mansa API request failed: {$curlError}");
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            throw new \Exception("Mansa API returned HTTP {$httpCode}: " . substr((string) $body, 0, 300));
        }

        $decoded = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception("Mansa API returned invalid JSON");
        }

        // TODO: confirm the actual top-level wrapper key.
        $rawRows = $decoded['data'] ?? $decoded['holidays'] ?? (is_array($decoded) ? $decoded : []);

        $mapped = [];
        foreach ($rawRows as $row) {
            if (is_array($row)) {
                $mapped[] = $this->mapMansaRow($row);
            }
        }
        return $mapped;
    }

    /**
     * Normalize a single Mansa API row into our internal shape.
     *
     * Confirmed real Mansa response shape (2026-07-26):
     *   { "date": "2026-01-01 00:00:00", "name": "Mwaka mpya", "type": "public", "observed": false }
     * Some dates carry a timezone offset too, e.g. "2026-03-20 00:00:00 -0600"
     * (moving/lunar holidays like Idd). There is no per-holiday "id" field,
     * so source_id will always be null for Mansa imports — that's expected.
     */
    private function mapMansaRow(array $row): array
    {
        $rawDate = $row['date'] ?? $row['holiday_date'] ?? null;

        return [
            // Mansa's "date" is a full datetime (sometimes with a trailing
            // UTC offset). We only need the calendar date for our DATE
            // column, and the date always starts the string, so a plain
            // substr is safer than a timezone-aware parse here.
            'holiday_date' => $rawDate ? substr($rawDate, 0, 10) : null,
            'name'         => $row['name'] ?? $row['local_name'] ?? $row['title'] ?? null,
            'type'         => $this->normalizeType($row['type'] ?? null),
            'source_id'    => isset($row['id']) ? (string) $row['id'] : null,
        ];
    }

    private function normalizeType(?string $type): ?string
    {
        $type = $type ? strtolower(trim($type)) : null;

        // Mansa's "type" values don't line up 1:1 with our enum
        // (national, regional, religious, bank, observance). Map the
        // ones we've seen; anything unmapped/unknown falls through to
        // NULL rather than failing the whole row.
        $aliasMap = [
            'public' => 'national',
        ];
        $type = $aliasMap[$type] ?? $type;

        $allowed = ['national', 'regional', 'religious', 'bank', 'observance'];
        return in_array($type, $allowed, true) ? $type : null;
    }

    /**
     * Insert/update public_holidays_master, then deactivate (never delete)
     * any previously-imported holiday for this country/year that the API
     * no longer returned.
     */
    private function syncToMaster(string $countryCode, int $year, array $rows): array
    {
        $inserted    = 0;
        $updated     = 0;
        $deactivated = 0;
        $warnings    = [];
        $seenKeys    = []; // "date|name" pairs returned by the API this run

        foreach ($rows as $row) {
            if (empty($row['holiday_date']) || empty($row['name'])) {
                continue; // skip malformed rows rather than fail the whole import
            }

            $seenKeys[] = $row['holiday_date'] . '|' . $row['name'];

            $existing = DB::raw(
                "SELECT id FROM public_holidays_master
                 WHERE country_code = :cc AND holiday_date = :date AND name = :name
                 LIMIT 1",
                [':cc' => $countryCode, ':date' => $row['holiday_date'], ':name' => $row['name']]
            );

            if (!empty($existing)) {
                // Already exists for this country/date/name — refresh it and
                // count it as a duplicate/update per the spec's warning wording.
                DB::raw(
                    "UPDATE public_holidays_master
                     SET type = :type, source = 'api_mansa', source_id = :source_id,
                         is_active = 1, updated_at = NOW()
                     WHERE id = :id",
                    [
                        ':type'      => $row['type'],
                        ':source_id' => $row['source_id'],
                        ':id'        => $existing[0]->id,
                    ]
                );
                $updated++;
            } else {
                DB::raw(
                    "INSERT INTO public_holidays_master
                        (country_code, holiday_date, name, type, is_active, source, source_id, created_at, updated_at)
                     VALUES
                        (:cc, :date, :name, :type, 1, 'api_mansa', :source_id, NOW(), NOW())",
                    [
                        ':cc'        => $countryCode,
                        ':date'      => $row['holiday_date'],
                        ':name'      => $row['name'],
                        ':type'      => $row['type'],
                        ':source_id' => $row['source_id'],
                    ]
                );
                $inserted++;
            }
        }

        // Deactivate previously-imported holidays for this country/year that
        // the API no longer returned. Never delete — keep audit history intact.
        $existingForYear = DB::raw(
            "SELECT id, holiday_date, name FROM public_holidays_master
             WHERE country_code = :cc AND YEAR(holiday_date) = :year AND is_active = 1",
            [':cc' => $countryCode, ':year' => $year]
        );

        foreach ($existingForYear as $row) {
            $key = $row->holiday_date . '|' . $row->name;
            if (!in_array($key, $seenKeys, true)) {
                DB::raw(
                    "UPDATE public_holidays_master SET is_active = 0, updated_at = NOW() WHERE id = :id",
                    [':id' => $row->id]
                );
                $deactivated++;
            }
        }

        if ($updated > 0) {
            $warnings[] = "{$updated} holiday(s) already existed and were updated.";
        }
        if ($deactivated > 0) {
            $warnings[] = "{$deactivated} holiday(s) were deactivated because they were not returned by the API.";
        }

        return [
            'success'  => true,
            'warnings' => $warnings,
            'data'     => [
                'country_code' => $countryCode,
                'year'         => $year,
                'inserted'     => $inserted,
                'updated'      => $updated,
                'deactivated'  => $deactivated,
            ],
        ];
    }
}