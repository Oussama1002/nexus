<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM(
            'draft',
            'pending',
            'confirmed',
            'prepared',
            'shipped',
            'cancelled',
            'returned',
            'delivered',
            'other'
        ) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM(
            'draft',
            'pending',
            'confirmed',
            'cancelled',
            'returned',
            'delivered',
            'other'
        ) NOT NULL DEFAULT 'pending'");
    }
};
