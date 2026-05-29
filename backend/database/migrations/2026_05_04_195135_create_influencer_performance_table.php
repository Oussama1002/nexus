<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('influencer_performance', function (Blueprint $table) {
            $table->id();
            $table->foreignId('influencer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('influencer_collaboration_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->date('metric_date');
            $table->unsignedBigInteger('views')->default(0);
            $table->unsignedBigInteger('engagement')->default(0);
            $table->unsignedBigInteger('conversions')->default(0);
            $table->decimal('revenue', 12, 2)->default(0);
            $table->decimal('roi', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('influencer_performance');
    }
};
