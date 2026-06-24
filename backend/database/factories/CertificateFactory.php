<?php

namespace Database\Factories;

use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class CertificateFactory extends Factory
{
    protected $model = Certificate::class;

    public function definition(): array
    {
        return [
            'course_id' => Course::factory(),
            'enrollment_id' => Enrollment::factory(),
            'student_id' => Student::factory(),
            'certificate_number' => 'CERT-'.strtoupper(Str::random(10)),
            'verification_token' => (string) Str::uuid(),
            'issued_at' => now(),
        ];
    }
}
