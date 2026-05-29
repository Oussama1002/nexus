<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'gender')) {
                $table->string('gender', 30)->nullable()->after('address');
            }
        });

        Schema::table('leads', function (Blueprint $table) {
            if (! Schema::hasColumn('leads', 'product_interest')) {
                $table->string('product_interest', 255)->nullable()->after('estimated_value');
            }
            if (! Schema::hasColumn('leads', 'interest_level')) {
                $table->string('interest_level', 50)->nullable()->after('product_interest');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'gender')) {
                $table->dropColumn('gender');
            }
        });

        Schema::table('leads', function (Blueprint $table) {
            if (Schema::hasColumn('leads', 'product_interest')) {
                $table->dropColumn('product_interest');
            }
            if (Schema::hasColumn('leads', 'interest_level')) {
                $table->dropColumn('interest_level');
            }
        });
    }
};
