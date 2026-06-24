<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAcademyEnrollmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'student_id' => ['required', 'integer', 'exists:students,id'],
            'status' => ['nullable', Rule::in(['pending', 'active', 'completed', 'expired', 'cancelled'])],
            'enrollment_type' => ['nullable', Rule::in(['free', 'paid', 'manual', 'bulk'])],
            'price_paid' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'expires_at' => ['nullable', 'date'],
        ];
    }
}
