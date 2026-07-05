<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('brands', function (Blueprint $table) {
            $table->text('whatsapp_number')->nullable()->change();
        });

        foreach (DB::table('brands')->whereNotNull('whatsapp_number')->get() as $brand) {
            $val = $brand->whatsapp_number;
            if (!str_starts_with($val, '[')) {
                DB::table('brands')->where('id', $brand->id)->update([
                    'whatsapp_number' => json_encode([$val]),
                ]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('brands')->whereNotNull('whatsapp_number')->get() as $brand) {
            $arr = json_decode($brand->whatsapp_number, true);
            if (is_array($arr)) {
                DB::table('brands')->where('id', $brand->id)->update([
                    'whatsapp_number' => $arr[0] ?? null,
                ]);
            }
        }

        Schema::table('brands', function (Blueprint $table) {
            $table->string('whatsapp_number', 30)->nullable()->change();
        });
    }
};
