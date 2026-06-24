<?php

namespace Database\Factories;

use App\Models\Brand;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PaymentFactory extends Factory
{
    protected $model = Payment::class;

    public function definition(): array
    {
        return [
            'brand_id' => Brand::factory(),
            'course_id' => Course::factory(),
            'enrollment_id' => Enrollment::factory(),
            'student_id' => Student::factory(),
            'payment_method' => fake()->randomElement(['stripe', 'bank_transfer', 'manual']),
            'payment_status' => 'paid',
            'order_number' => 'ORD-'.strtoupper(Str::random(8)),
            'invoice_number' => 'INV-'.strtoupper(Str::random(8)),
            'transaction_reference' => strtoupper(Str::random(14)),
            'amount' => fake()->numberBetween(20, 300),
            'currency' => 'USD',
            'gateway_payload' => ['source' => 'factory'],
            'paid_at' => now(),
        ];
    }
}
