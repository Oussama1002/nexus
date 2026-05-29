<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class RestfulController extends Controller
{
    /** @return class-string<Model> */
    abstract protected static function modelClass(): string;

    protected function resourceLabel(): string
    {
        return class_basename(static::modelClass());
    }

    public function index(Request $request): JsonResponse
    {
        $class = static::modelClass();
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        return ApiResponse::success(
            $class::query()->paginate($perPage),
            $this->resourceLabel().' list retrieved successfully.'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $class = static::modelClass();
        /** @var Model $model */
        $model = new $class;
        $model->fill($request->only($model->getFillable()));
        $model->save();

        return ApiResponse::success($model->fresh(), $this->resourceLabel().' created successfully.', 201);
    }

    public function show(string $id): JsonResponse
    {
        $model = (static::modelClass())::query()->findOrFail($id);

        return ApiResponse::success($model, $this->resourceLabel().' retrieved successfully.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $model = (static::modelClass())::query()->findOrFail($id);
        $model->fill($request->only($model->getFillable()));
        $model->save();

        return ApiResponse::success($model->fresh(), $this->resourceLabel().' updated successfully.');
    }

    public function destroy(string $id): JsonResponse
    {
        $model = (static::modelClass())::query()->findOrFail($id);
        $model->delete();

        return ApiResponse::success(null, $this->resourceLabel().' deleted successfully.');
    }
}
