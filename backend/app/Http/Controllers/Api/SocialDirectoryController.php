<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SocialDirectoryController extends Controller
{
    /**
     * Users for Social dropdowns (CM / SMM / Admin) scoped to the active brand when applicable.
     */
    public function users(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $roleParam = (string) $request->query('roles', 'community_manager,smm,admin');
        $slugs = array_values(array_filter(array_map('trim', explode(',', $roleParam))));

        $q = User::query()
            ->with(['roles:id,slug,name'])
            ->whereHas('roles', fn ($r) => $r->whereIn('slug', $slugs))
            ->where(function ($w) use ($brandId) {
                $w->whereHas('brands', fn ($b) => $b->whereKey($brandId))
                    ->orWhereHas('roles', fn ($r) => $r->where('slug', 'admin'));
            })
            ->orderBy('name');

        $search = $request->query('search');
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', $s)->orWhere('email', 'like', $s);
            });
        }

        return ApiResponse::success(
            $q->limit(300)->get(['id', 'name', 'email']),
            'Users retrieved successfully.'
        );
    }
}
