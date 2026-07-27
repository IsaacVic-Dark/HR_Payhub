<?php

namespace App\Services;

/**
 * @package HolidayLookupService
 *
 * Answers:
 *   - "What public holidays apply to organization X for year Y?"
 *   - "Is date D a paid public holiday for organization X?"
 *
 * Design (Option 2 — inherited rows are never stored):
 *   - public_holidays_master  = the country-wide calendar (source of truth
 *                               per country_code, imported from Mansa).
 *   - org_public_holidays     = ONLY rows where an org deviates from the
 *                               master list:
 *       source = 'override'  -> org changes something about a master
 *                                holiday (is_paid, is_active, even the
 *                                date/name), linked via master_holiday_id.
 *       source = 'custom'    -> org-specific holiday that has no master
 *                                row at all (master_holiday_id is NULL).
 *   - "inherited" is never written. If there's no override row for a
 *     master holiday, that master holiday applies to the org as-is —
 *     that's what the branch below labelled source: 'inherited' means;
 *     it's a derived label on the response, not a DB row.
 *
 * @author Generated for PayHub
 */
class HolidayLookupService
{
    /**
     * Resolve an organization's ISO2 country code via
     * organizations.country_id -> countries.iso2.
     *
     * @return string|null Null if the org has no country_id set, or the
     *                     linked country is inactive.
     */
    public function resolveOrgCountryCode(int $orgId): ?string
    {
        $row = DB::raw(
            "SELECT c.iso2
             FROM organizations o
             INNER JOIN countries c ON o.country_id = c.id
             WHERE o.id = :org_id
               AND c.is_active = 1
             LIMIT 1",
            [':org_id' => $orgId]
        );

        return $row[0]->iso2 ?? null;
    }

    /**
     * Full merged holiday list for an organization/year.
     *
     * @return array{country_code: string, holidays: array<int, array>}
     * @throws \Exception if the org has no active country assigned
     */
    public function getOrgHolidays(int $orgId, int $year): array
    {
        $countryCode = $this->resolveOrgCountryCode($orgId);
        if (!$countryCode) {
            throw new \Exception("Organization has no active country assigned");
        }

        $masterHolidays = DB::raw(
            "SELECT id, holiday_date, name, type
             FROM public_holidays_master
             WHERE country_code = :cc
               AND YEAR(holiday_date) = :year
               AND is_active = 1
             ORDER BY holiday_date ASC",
            [':cc' => $countryCode, ':year' => $year]
        );

        $overrides = DB::raw(
            "SELECT id, master_holiday_id, holiday_date, name, is_paid, is_active, notes
             FROM org_public_holidays
             WHERE organization_id = :org_id
               AND source = 'override'
               AND YEAR(holiday_date) = :year",
            [':org_id' => $orgId, ':year' => $year]
        );

        // Index overrides by master_holiday_id for O(1) lookup while merging.
        $overrideByMaster = [];
        foreach ($overrides as $o) {
            $overrideByMaster[$o->master_holiday_id] = $o;
        }

        $result = [];

        foreach ($masterHolidays as $m) {
            $o = $overrideByMaster[$m->id] ?? null;

            if ($o) {
                if (!$o->is_active) {
                    // Org explicitly disabled this master holiday — skip entirely.
                    continue;
                }
                $result[] = [
                    'date'              => $o->holiday_date,
                    'name'              => $o->name,
                    'type'              => $m->type,
                    'is_paid'           => (bool) $o->is_paid,
                    'source'            => 'override',
                    'master_holiday_id' => $m->id,
                    'org_holiday_id'    => $o->id,
                    'notes'             => $o->notes,
                ];
                continue;
            }

            // No override row -> implicit "inherited": master applies as-is.
            // This branch is the entire "inherited" concept — nothing is persisted.
            $result[] = [
                'date'              => $m->holiday_date,
                'name'              => $m->name,
                'type'              => $m->type,
                'is_paid'           => true,
                'source'            => 'inherited',
                'master_holiday_id' => $m->id,
                'org_holiday_id'    => null,
                'notes'             => null,
            ];
        }

        $customs = DB::raw(
            "SELECT id, holiday_date, name, is_paid, notes
             FROM org_public_holidays
             WHERE organization_id = :org_id
               AND source = 'custom'
               AND is_active = 1
               AND YEAR(holiday_date) = :year",
            [':org_id' => $orgId, ':year' => $year]
        );

        foreach ($customs as $c) {
            $result[] = [
                'date'              => $c->holiday_date,
                'name'              => $c->name,
                'type'              => null,
                'is_paid'           => (bool) $c->is_paid,
                'source'            => 'custom',
                'master_holiday_id' => null,
                'org_holiday_id'    => $c->id,
                'notes'             => $c->notes,
            ];
        }

        usort($result, fn($a, $b) => strcmp($a['date'], $b['date']));

        return [
            'country_code' => $countryCode,
            'holidays'     => $result,
        ];
    }

    /**
     * "Is $date (YYYY-MM-DD) a paid public holiday for organization $orgId?"
     *
     * @return array{is_holiday: bool, is_paid: bool, holiday: array|null}
     */
    public function isHoliday(int $orgId, string $date): array
    {
        $year = (int) substr($date, 0, 4);
        $merged = $this->getOrgHolidays($orgId, $year);

        foreach ($merged['holidays'] as $h) {
            if ($h['date'] === $date) {
                return [
                    'is_holiday' => true,
                    'is_paid'    => $h['is_paid'],
                    'holiday'    => $h,
                ];
            }
        }

        return ['is_holiday' => false, 'is_paid' => false, 'holiday' => null];
    }
}