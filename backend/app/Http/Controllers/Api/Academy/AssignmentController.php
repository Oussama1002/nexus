<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\User;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AssignmentController extends Controller
{
    /**
     * POST /api/academy/assignments
     * Body: { course_id, user_ids: [int], due_at?: datetime }
     * Assigns the course to each user — creates Student (if missing) + Enrollment.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'due_at' => ['nullable', 'date'],
        ]);

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($data['course_id']);
        $actor = $request->user();

        $assigned = 0;
        $alreadyEnrolled = 0;
        $errors = [];

        foreach ($data['user_ids'] as $userId) {
            $target = User::query()->find($userId);
            if (! $target) {
                $errors[] = "Utilisateur #{$userId} introuvable.";
                continue;
            }

            $student = Student::query()
                ->where('brand_id', $brandId)
                ->where(function ($q) use ($target) {
                    $q->where('user_id', $target->id)->orWhere('email', $target->email);
                })
                ->first();

            if (! $student) {
                $student = new Student([
                    'brand_id' => $brandId,
                    'user_id' => $target->id,
                    'full_name' => $target->name,
                    'email' => $target->email,
                    'phone' => $target->phone,
                    'status' => 'active',
                    'created_by' => $actor?->id,
                    'updated_by' => $actor?->id,
                ]);
                $student->save();
            } elseif (! $student->user_id) {
                $student->user_id = $target->id;
                $student->save();
            }

            $enrollment = Enrollment::query()
                ->where('course_id', $course->id)
                ->where('student_id', $student->id)
                ->first();

            if ($enrollment) {
                $alreadyEnrolled++;
                $enrollment->due_at = $data['due_at'] ?? $enrollment->due_at;
                $enrollment->assigned_by = $actor?->id;
                $enrollment->save();
                continue;
            }

            $enrollment = new Enrollment([
                'brand_id' => $brandId,
                'course_id' => $course->id,
                'student_id' => $student->id,
                'assigned_by' => $actor?->id,
                'status' => 'pending',
                'enrollment_type' => 'manual',
                'price_paid' => 0,
                'currency' => 'MAD',
                'progress_percent' => 0,
                'enrolled_at' => now(),
                'due_at' => $data['due_at'] ?? null,
                'created_by' => $actor?->id,
                'updated_by' => $actor?->id,
            ]);
            $enrollment->save();
            $assigned++;
        }

        return ApiResponse::success([
            'assigned' => $assigned,
            'already_enrolled' => $alreadyEnrolled,
            'errors' => $errors,
        ], 'Assignations enregistrées.');
    }
}
