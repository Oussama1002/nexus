<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'brand_id' => $this->brand_id,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'company' => $this->company,
            'position' => $this->position,
            'avatar_url' => $this->avatar_url,
            'status' => $this->status,
            'last_activity_at' => $this->last_activity_at,
            'enrollments_count' => $this->whenCounted('enrollments'),
            'certificates_count' => $this->whenCounted('certificates'),
        ];
    }
}
