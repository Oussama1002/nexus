<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CarrierCity extends Model
{
    use HasFactory;

    protected $fillable = [
        'delivery_company_id',
        'name',
        'normalized_name',
        'external_id',
    ];

    public function deliveryCompany()
    {
        return $this->belongsTo(DeliveryCompany::class);
    }

    /** Normalise un nom de ville pour l'unicité et le matching (minuscule, sans accents). */
    public static function normalize(string $name): string
    {
        $ascii = \Illuminate\Support\Str::ascii($name);

        return mb_strtolower(trim(preg_replace('/\s+/', ' ', $ascii)));
    }
}
