<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $brands = DB::table('brands')->get(['id', 'code']);

        foreach ($brands as $brand) {
            if (! $brand->code) {
                continue;
            }

            $prefix = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $brand->code), 0, 6));

            $products = DB::table('products')
                ->where('brand_id', $brand->id)
                ->where('sku', 'like', 'PRD-%')
                ->orderBy('id')
                ->get(['id', 'sku']);

            $seq = 1;
            foreach ($products as $product) {
                DB::table('products')
                    ->where('id', $product->id)
                    ->update(['sku' => sprintf('%s-%04d', $prefix, $seq)]);
                $seq++;
            }
        }
    }

    public function down(): void
    {
        // Not reversible
    }
};
