import { useState, useEffect, useCallback, useRef } from 'react';
import type { Role } from '../types';
import { ALL_ROLES } from '../lib/roleFilter';

function formatRoleLabel(role: Role): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface RoleFilterProps {
  value: Set<Role>;
  onChange: (value: Set<Role>) => void;
}

export function RoleFilter({ value, onChange }: RoleFilterProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const handleToggle = (role: Role) => {
    const next = new Set(value);
    if (next.has(role)) {
      next.delete(role);
    } else {
      next.add(role);
    }
    onChange(next);
  };

  const selectAll = () => onChange(new Set(ALL_ROLES));

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const triggerEl = triggerRef.current;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
      triggerEl?.focus();
    };
  }, [open, close]);

  const count = value.size;
  const label =
    count === ALL_ROLES.length
      ? 'All roles'
      : `${count} role${count === 1 ? '' : 's'}`;

  return (
    <div className="role-filter">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="role-filter__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Filter by role"
      >
        {label}
      </button>

      {open && (
        <div
          className="role-filter__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-filter-title"
        >
          <div className="role-filter__backdrop" onClick={close} aria-hidden />
          <div className="role-filter__popup">
            <div className="role-filter__popup-header">
              <h3 id="role-filter-title" className="role-filter__popup-title">
                Show roles
              </h3>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="role-filter__popup-close"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="role-filter__popup-body">
              <div className="role-filter__presets">
                <button
                  type="button"
                  onClick={selectAll}
                  className="role-filter__preset"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange(new Set(['core_starter', 'starter_when_healthy']))
                  }
                  className="role-filter__preset"
                >
                  Starters
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      new Set([
                        'core_starter',
                        'starter_when_healthy',
                        'significant_contributor',
                        'depth',
                      ]),
                    )
                  }
                  className="role-filter__preset"
                >
                  Contributors
                </button>
              </div>
              <div className="role-filter__checkboxes">
                {ALL_ROLES.map((role) => (
                  <label key={role} className="role-filter__checkbox">
                    <input
                      type="checkbox"
                      checked={value.has(role)}
                      onChange={() => handleToggle(role)}
                      aria-label={`Show ${formatRoleLabel(role)}`}
                    />
                    <span>{formatRoleLabel(role)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
