<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'discount')) {
                $table->decimal('discount', 12, 2)->default(0)->after('shipping_fee');
            }
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            if (! Schema::hasColumn('products', 'reserved_quantity')) {
                Schema::table('products', function (Blueprint $table) {
                    $table->unsignedInteger('reserved_quantity')->default(0);
                });
            }
            if (Schema::hasColumn('products', 'stock') && ! Schema::hasColumn('products', 'stock_quantity')) {
                Schema::table('products', function (Blueprint $table) {
                    $table->integer('stock_quantity')->default(0);
                });
                DB::table('products')->update([
                    'stock_quantity' => DB::raw('stock'),
                ]);
                Schema::table('products', function (Blueprint $table) {
                    $table->dropColumn('stock');
                });
            }
        } else {
            Schema::table('products', function (Blueprint $table) {
                if (! Schema::hasColumn('products', 'reserved_quantity')) {
                    $table->unsignedInteger('reserved_quantity')->default(0)->after('stock');
                }
            });
            if (Schema::hasColumn('products', 'stock') && ! Schema::hasColumn('products', 'stock_quantity')) {
                DB::statement('ALTER TABLE products CHANGE stock stock_quantity INT NOT NULL DEFAULT 0');
            }
        }

        if ($driver === 'mysql') {
            try {
                DB::statement('ALTER TABLE stock_movements MODIFY movement_type VARCHAR(40) NOT NULL');
            } catch (\Throwable) {
                // ignore if already varchar
            }
        }
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'discount')) {
                $table->dropColumn('discount');
            }
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            if (Schema::hasColumn('products', 'stock_quantity') && ! Schema::hasColumn('products', 'stock')) {
                Schema::table('products', function (Blueprint $table) {
                    $table->integer('stock')->default(0);
                });
                DB::table('products')->update(['stock' => DB::raw('stock_quantity')]);
                Schema::table('products', function (Blueprint $table) {
                    $table->dropColumn('stock_quantity');
                });
            }
            if (Schema::hasColumn('products', 'reserved_quantity')) {
                Schema::table('products', function (Blueprint $table) {
                    $table->dropColumn('reserved_quantity');
                });
            }
        } else {
            if (Schema::hasColumn('products', 'stock_quantity') && ! Schema::hasColumn('products', 'stock')) {
                DB::statement('ALTER TABLE products CHANGE stock_quantity stock INT NOT NULL DEFAULT 0');
            }
            Schema::table('products', function (Blueprint $table) {
                if (Schema::hasColumn('products', 'reserved_quantity')) {
                    $table->dropColumn('reserved_quantity');
                }
            });
        }
    }
};
