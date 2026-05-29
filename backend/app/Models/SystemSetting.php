<?php

namespace App\Models;

use App\Support\SystemSettingRegistry;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'setting_key',
        'setting_group',
        'setting_value',
        'value_type',
        'is_sensitive',
        'description',
    ];

    protected $casts = [
        'is_sensitive' => 'boolean',
    ];

    /**
     * @param  array<string, mixed>  $attrs
     * @return array<string, mixed>
     */
    public static function maskSensitiveArray(array $attrs): array
    {
        if (! empty($attrs['is_sensitive'])) {
            $attrs['setting_value'] = SystemSettingRegistry::MASK_DISPLAY;

            return $attrs;
        }

        return $attrs;
    }

    /** Valeur inchangée : vide ou uniquement des astérisques (réponse masquée). */
    public static function valueIsUnchangedSecretPlaceholder(?string $value): bool
    {
        if ($value === null || $value === '') {
            return true;
        }

        return (bool) preg_match('/^\*+$/', $value);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }
}
