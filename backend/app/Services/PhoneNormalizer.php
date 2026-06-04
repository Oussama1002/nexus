<?php

namespace App\Services;

class PhoneNormalizer
{
    /**
     * Generate all reasonable variants of a phone number for duplicate detection.
     * Supports Morocco (+212 / 0x) format.
     *
     * @return string[]
     */
    public static function variants(string $phone): array
    {
        $phone = trim($phone);
        if ($phone === '') {
            return [];
        }

        $digits = preg_replace('/\D/', '', $phone);
        $variants = [$phone];

        // International → local: +212XXXXXXXXX → 0XXXXXXXXX
        if (str_starts_with($digits, '212') && strlen($digits) >= 12) {
            $local = '0' . substr($digits, 3);
            $variants[] = $local;
            $variants[] = '+' . $digits;
            $variants[] = $digits;
        }
        // Local → international: 0XXXXXXXXX → +212XXXXXXXXX
        elseif (str_starts_with($digits, '0') && strlen($digits) >= 9) {
            $intl = '212' . substr($digits, 1);
            $variants[] = '+' . $intl;
            $variants[] = $intl;
            $variants[] = $digits;
        }

        return array_values(array_unique($variants));
    }

    /**
     * Check if a customer with any variant of this phone already exists for the brand.
     */
    public static function existsForBrand(int $brandId, string $phone): bool
    {
        $variants = self::variants($phone);
        if (empty($variants)) {
            return false;
        }

        return \App\Models\Customer::query()
            ->where('brand_id', $brandId)
            ->where(function ($q) use ($variants) {
                foreach ($variants as $v) {
                    $q->orWhere('phone', $v);
                }
            })
            ->exists();
    }
}
