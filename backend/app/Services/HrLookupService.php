<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\HrLookupValue;
use Illuminate\Support\Collection;

class HrLookupService
{
    /** @return list<string> */
    public function values(string $type, ?int $brandId): array
    {
        $this->assertType($type);

        $scopeBrandId = $type === HrLookupValue::TYPE_DEPARTMENT ? null : $brandId;

        $fromTable = HrLookupValue::query()
            ->when($scopeBrandId, fn ($q) => $q->where('brand_id', $scopeBrandId))
            ->where('type', $type)
            ->orderBy('value')
            ->pluck('value')
            ->all();

        $fromEmployees = Employee::query()
            ->when($scopeBrandId, fn ($q) => $q->where('brand_id', $scopeBrandId))
            ->whereNotNull($type === HrLookupValue::TYPE_DEPARTMENT ? 'department' : 'role_title')
            ->where($type === HrLookupValue::TYPE_DEPARTMENT ? 'department' : 'role_title', '!=', '')
            ->distinct()
            ->orderBy($type === HrLookupValue::TYPE_DEPARTMENT ? 'department' : 'role_title')
            ->pluck($type === HrLookupValue::TYPE_DEPARTMENT ? 'department' : 'role_title')
            ->all();

        return Collection::make([...$fromTable, ...$fromEmployees])
            ->map(fn ($v) => trim((string) $v))
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    public function remember(?int $brandId, string $type, ?string $value): void
    {
        $this->assertType($type);
        $value = trim((string) $value);
        if ($value === '') {
            return;
        }

        HrLookupValue::query()->firstOrCreate([
            'brand_id' => $brandId,
            'type' => $type,
            'value' => $value,
        ]);
    }

    private function assertType(string $type): void
    {
        if (! in_array($type, [HrLookupValue::TYPE_DEPARTMENT, HrLookupValue::TYPE_ROLE_TITLE], true)) {
            throw new \InvalidArgumentException('Invalid HR lookup type.');
        }
    }
}
