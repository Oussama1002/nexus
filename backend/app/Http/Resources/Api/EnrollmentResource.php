<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EnrollmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'brand_id' => $this->brand_id,
            'status' => $this->status,
            'enrollment_type' => $this->enrollment_type,
            'price_paid' => $this->price_paid,
            'currency' => $this->currency,
            'progress_percent' => $this->progress_percent,
            'enrolled_at' => $this->enrolled_at,
            'expires_at' => $this->expires_at,
            'completed_at' => $this->completed_at,
            'course' => $this->whenLoaded('course', fn () => [
                'id' => $this->course?->id,
                'title' => $this->course?->title,
            ]),
            'student' => $this->whenLoaded('student', fn () => [
                'id' => $this->student?->id,
                'full_name' => $this->student?->full_name,
                'email' => $this->student?->email,
            ]),
        ];
    }
}
