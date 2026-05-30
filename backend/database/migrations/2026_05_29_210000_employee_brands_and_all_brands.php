<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            if (! Schema::hasColumn('employees', 'all_brands')) {
                $table->boolean('all_brands')->default(false)->after('brand_id');
            }
        });

        if (! Schema::hasTable('employee_brand')) {
            Schema::create('employee_brand', function (Blueprint $table) {
                $table->id();
                $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
                $table->foreignId('brand_id')->constrained('brands')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['employee_id', 'brand_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_brand');

        Schema::table('employees', function (Blueprint $table) {
            if (Schema::hasColumn('employees', 'all_brands')) {
                $table->dropColumn('all_brands');
            }
        });
    }
};
