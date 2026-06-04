<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            // SQLite doesn't support ALTER COLUMN; recreate the table
            DB::statement('PRAGMA foreign_keys = OFF');
            Schema::rename('charges', 'charges_old');
            Schema::create('charges', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->date('charge_date');
                $table->string('type', 30)->default('other');
                $table->decimal('amount', 12, 2);
                $table->text('note')->nullable();
                $table->timestamps();
            });
            DB::statement('INSERT INTO charges SELECT * FROM charges_old');
            Schema::drop('charges_old');
            DB::statement('PRAGMA foreign_keys = ON');
        } else {
            // MySQL: simply change to varchar
            Schema::table('charges', function (Blueprint $table) {
                $table->string('type', 30)->default('other')->change();
            });
        }
    }

    public function down(): void
    {
        // No rollback needed
    }
};
