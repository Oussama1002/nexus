<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->time('lunch_start_time')->nullable()->after('work_end_time');
            $table->time('lunch_end_time')->nullable()->after('lunch_start_time');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['lunch_start_time', 'lunch_end_time']);
        });
    }
};
