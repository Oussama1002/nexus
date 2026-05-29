<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'status',
        'email_verified_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    public function roles()
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    public function brands()
    {
        return $this->belongsToMany(Brand::class, 'brand_users');
    }

    public function isAdmin(): bool
    {
        $this->loadMissing('roles');

        return $this->roles->contains('slug', 'admin');
    }

    public function isManagerOperational(): bool
    {
        $this->loadMissing('roles');

        return $this->roles->contains('slug', 'manager_operationnel');
    }

    public function isClientBrandOwner(): bool
    {
        $this->loadMissing('roles');

        return $this->roles->contains('slug', 'client_brand_owner');
    }

    public function canViewAllConversations(): bool
    {
        return $this->isAdmin() || $this->isManagerOperational();
    }

    /**
     * Confirmatrice sees only shipments for orders assigned to her (unless elevated ops role).
     */
    /**
     * @return string[]
     */
    public function allPermissionSlugs(): array
    {
        $this->loadMissing('roles.permissions');

        return $this->roles
            ->flatMap(fn ($r) => $r->permissions)
            ->pluck('slug')
            ->unique()
            ->values()
            ->all();
    }

    public function hasPermissionSlug(string $slug): bool
    {
        if ($this->isAdmin()) {
            return true;
        }
        $slugs = $this->allPermissionSlugs();
        if (in_array($slug, $slugs, true)) {
            return true;
        }
        $dot = strrpos($slug, '.');
        if ($dot <= 0) {
            return false;
        }
        $mod = substr($slug, 0, $dot);

        return in_array($mod.'.*', $slugs, true);
    }

    public function shouldRestrictShipmentsToAssignedOrders(): bool
    {
        $this->loadMissing('roles');
        $slugs = $this->roles->pluck('slug')->all();
        if (array_intersect($slugs, ['admin', 'manager_operationnel', 'stock_manager'])) {
            return false;
        }

        return in_array('confirmatrice', $slugs, true);
    }
}
