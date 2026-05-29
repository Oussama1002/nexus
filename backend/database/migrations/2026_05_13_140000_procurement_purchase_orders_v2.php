<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_orders', 'po_number') && ! Schema::hasColumn('purchase_orders', 'reference')) {
                $table->renameColumn('po_number', 'reference');
            }
            if (Schema::hasColumn('purchase_orders', 'expected_date') && ! Schema::hasColumn('purchase_orders', 'expected_delivery_date')) {
                $table->renameColumn('expected_date', 'expected_delivery_date');
            }
            if (Schema::hasColumn('purchase_orders', 'note') && ! Schema::hasColumn('purchase_orders', 'internal_notes')) {
                $table->renameColumn('note', 'internal_notes');
            }
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('purchase_orders', 'ordered_at')) {
                $table->date('ordered_at')->nullable()->after('created_by');
            }
            if (! Schema::hasColumn('purchase_orders', 'responsible_user_id')) {
                $table->foreignId('responsible_user_id')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('purchase_orders', 'currency')) {
                $table->string('currency', 8)->default('MAD')->after('payment_status');
            }
            if (! Schema::hasColumn('purchase_orders', 'subtotal')) {
                $table->decimal('subtotal', 15, 2)->default(0)->after('currency');
            }
            if (! Schema::hasColumn('purchase_orders', 'discount')) {
                $table->decimal('discount', 15, 2)->default(0)->after('subtotal');
            }
            if (! Schema::hasColumn('purchase_orders', 'tax')) {
                $table->decimal('tax', 15, 2)->default(0)->after('discount');
            }
            if (! Schema::hasColumn('purchase_orders', 'paid_amount')) {
                $table->decimal('paid_amount', 15, 2)->default(0)->after('total_amount');
            }
            if (! Schema::hasColumn('purchase_orders', 'remaining_amount')) {
                $table->decimal('remaining_amount', 15, 2)->default(0)->after('paid_amount');
            }
            if (! Schema::hasColumn('purchase_orders', 'payment_method')) {
                $table->string('payment_method', 64)->nullable()->after('remaining_amount');
            }
            if (! Schema::hasColumn('purchase_orders', 'payment_due_date')) {
                $table->date('payment_due_date')->nullable()->after('payment_method');
            }
            if (! Schema::hasColumn('purchase_orders', 'shipping_mode')) {
                $table->string('shipping_mode', 64)->nullable()->after('payment_due_date');
            }
            if (! Schema::hasColumn('purchase_orders', 'carrier_name')) {
                $table->string('carrier_name', 255)->nullable()->after('shipping_mode');
            }
            if (! Schema::hasColumn('purchase_orders', 'tracking_number')) {
                $table->string('tracking_number', 255)->nullable()->after('carrier_name');
            }
            if (! Schema::hasColumn('purchase_orders', 'shipping_fee')) {
                $table->decimal('shipping_fee', 15, 2)->nullable()->after('tracking_number');
            }
            if (! Schema::hasColumn('purchase_orders', 'warehouse_destination')) {
                $table->string('warehouse_destination', 255)->nullable()->after('shipping_fee');
            }
            if (! Schema::hasColumn('purchase_orders', 'supplier_conditions')) {
                $table->text('supplier_conditions')->nullable()->after('warehouse_destination');
            }
            if (! Schema::hasColumn('purchase_orders', 'attachments_json')) {
                $table->json('attachments_json')->nullable()->after('supplier_conditions');
            }
            if (! Schema::hasColumn('purchase_orders', 'supplier_invoice_ref')) {
                $table->string('supplier_invoice_ref', 255)->nullable()->after('attachments_json');
            }
            if (! Schema::hasColumn('purchase_orders', 'delivery_note_ref')) {
                $table->string('delivery_note_ref', 255)->nullable()->after('supplier_invoice_ref');
            }
        });

        Schema::table('purchase_order_lines', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_order_lines', 'quantity') && ! Schema::hasColumn('purchase_order_lines', 'quantity_ordered')) {
                $table->renameColumn('quantity', 'quantity_ordered');
            }
            if (Schema::hasColumn('purchase_order_lines', 'received_quantity') && ! Schema::hasColumn('purchase_order_lines', 'quantity_received')) {
                $table->renameColumn('received_quantity', 'quantity_received');
            }
            if (Schema::hasColumn('purchase_order_lines', 'unit_cost') && ! Schema::hasColumn('purchase_order_lines', 'unit_price')) {
                $table->renameColumn('unit_cost', 'unit_price');
            }
        });

        Schema::table('purchase_order_lines', function (Blueprint $table) {
            if (! Schema::hasColumn('purchase_order_lines', 'sku_snapshot')) {
                $table->string('sku_snapshot', 128)->nullable()->after('product_id');
            }
            if (! Schema::hasColumn('purchase_order_lines', 'product_name_snapshot')) {
                $table->string('product_name_snapshot', 512)->nullable()->after('sku_snapshot');
            }
            if (! Schema::hasColumn('purchase_order_lines', 'line_discount')) {
                $table->decimal('line_discount', 15, 4)->default(0)->after('unit_price');
            }
            if (! Schema::hasColumn('purchase_order_lines', 'line_tax')) {
                $table->decimal('line_tax', 15, 4)->default(0)->after('line_discount');
            }
        });

        if (Schema::hasColumn('purchase_orders', 'ordered_at')) {
            DB::table('purchase_orders')->whereNull('ordered_at')->update([
                'ordered_at' => DB::raw('DATE(created_at)'),
            ]);
        }

        if (Schema::hasColumn('purchase_orders', 'remaining_amount') && Schema::hasColumn('purchase_orders', 'paid_amount')) {
            DB::statement('UPDATE purchase_orders SET remaining_amount = total_amount - paid_amount WHERE remaining_amount = 0 AND paid_amount = 0');
        }
    }

    public function down(): void
    {
        Schema::table('purchase_order_lines', function (Blueprint $table) {
            foreach (['line_tax', 'line_discount', 'product_name_snapshot', 'sku_snapshot'] as $col) {
                if (Schema::hasColumn('purchase_order_lines', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('purchase_order_lines', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_order_lines', 'quantity_ordered') && ! Schema::hasColumn('purchase_order_lines', 'quantity')) {
                $table->renameColumn('quantity_ordered', 'quantity');
            }
            if (Schema::hasColumn('purchase_order_lines', 'quantity_received') && ! Schema::hasColumn('purchase_order_lines', 'received_quantity')) {
                $table->renameColumn('quantity_received', 'received_quantity');
            }
            if (Schema::hasColumn('purchase_order_lines', 'unit_price') && ! Schema::hasColumn('purchase_order_lines', 'unit_cost')) {
                $table->renameColumn('unit_price', 'unit_cost');
            }
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            foreach ([
                'delivery_note_ref', 'supplier_invoice_ref', 'attachments_json', 'supplier_conditions',
                'warehouse_destination', 'shipping_fee', 'tracking_number', 'carrier_name', 'shipping_mode',
                'payment_due_date', 'payment_method', 'remaining_amount', 'paid_amount',
                'tax', 'discount', 'subtotal', 'currency', 'responsible_user_id', 'ordered_at',
            ] as $col) {
                if (Schema::hasColumn('purchase_orders', $col)) {
                    if ($col === 'responsible_user_id') {
                        $table->dropForeign(['responsible_user_id']);
                    }
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_orders', 'reference') && ! Schema::hasColumn('purchase_orders', 'po_number')) {
                $table->renameColumn('reference', 'po_number');
            }
            if (Schema::hasColumn('purchase_orders', 'expected_delivery_date') && ! Schema::hasColumn('purchase_orders', 'expected_date')) {
                $table->renameColumn('expected_delivery_date', 'expected_date');
            }
            if (Schema::hasColumn('purchase_orders', 'internal_notes') && ! Schema::hasColumn('purchase_orders', 'note')) {
                $table->renameColumn('internal_notes', 'note');
            }
        });
    }
};
