<?php

namespace App\Services;

/**
 * Decimal-safe money helper. All arithmetic is done on integer cents.
 * Floats are accepted only at the boundary and are converted through
 * number_format() (2 dp) before parsing. Never do money maths on floats.
 */
final class Money
{
    public static function toCents($value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }
        if (is_int($value)) {
            return $value * 100;
        }
        if (is_float($value)) {
            $value = number_format($value, 2, '.', '');
        }
        $s = trim((string) $value);
        if (!preg_match('/^(-)?(\d+)(?:\.(\d+))?$/', $s, $m)) {
            throw new \InvalidArgumentException("Invalid money value: {$s}");
        }
        $neg   = $m[1] === '-';
        $frac  = $m[3] ?? '';
        $cents = (int) str_pad(substr($frac, 0, 2), 2, '0');
        if (strlen($frac) > 2 && (int) $frac[2] >= 5) {
            $cents++; // round half up
        }
        $total = ((int) $m[2]) * 100 + $cents;
        return $neg ? -$total : $total;
    }

    public static function isValid($value): bool
    {
        try {
            self::toCents($value);
            return true;
        } catch (\InvalidArgumentException $e) {
            return false;
        }
    }

    /** 123456 => "1234.56" */
    public static function format(int $cents): string
    {
        $neg = $cents < 0;
        $abs = abs($cents);
        return ($neg ? '-' : '') . intdiv($abs, 100) . '.' . str_pad((string) ($abs % 100), 2, '0', STR_PAD_LEFT);
    }

    /** 1234567 => "12,345.67" */
    public static function display(int $cents): string
    {
        $neg = $cents < 0;
        $abs = abs($cents);
        return ($neg ? '-' : '') . number_format(intdiv($abs, 100)) . '.' . str_pad((string) ($abs % 100), 2, '0', STR_PAD_LEFT);
    }

    /** Integer division rounded half-up (non-negative numerator). */
    public static function divRound(int $numerator, int $denominator): int
    {
        if ($denominator <= 0) {
            throw new \InvalidArgumentException('Denominator must be positive');
        }
        return intdiv(2 * $numerator + $denominator, 2 * $denominator);
    }

    /** $percent is a decimal like "50" or "12.5"; result rounded half-up. */
    public static function percentOf(int $cents, $percent): int
    {
        $hundredths = self::toCents($percent); // 50.00% => 5000
        return self::divRound($cents * $hundredths, 10000);
    }
}