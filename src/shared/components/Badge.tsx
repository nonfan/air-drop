interface BadgeProps {
  text: string;
}

/** 通用 Badge */
export function Badge({ text }: BadgeProps) {
  return (
    <div
      style={{
        display: 'inline-block',
        fontSize: '10px',
        color: 'var(--muted)',
        padding: '4px 8px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(8px)',
        borderRadius: '4px',
        border: '1px solid rgba(var(--muted-rgb, 156, 163, 175), 0.3)',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        pointerEvents: 'auto',
        lineHeight: '12px'
      }}
    >
      {text}
    </div>
  );
}

/** 成功 */
export function BadgeSuccess({ text }: BadgeProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        color: 'var(--success)',
        padding: '4px 8px',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        backdropFilter: 'blur(8px)',
        borderRadius: '4px',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        pointerEvents: 'auto',
        animation: 'fadeIn 0.2s ease-in-out',
        lineHeight: '1'
      }}
    >
      <svg
        style={{
          width: '12px',
          height: '12px',
          flexShrink: 0,
          display: 'block'
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span style={{ display: 'block' }}>{text}</span>
    </div>
  );
}

/** 错误 */
export function BadgeError({ text }: BadgeProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        color: 'var(--danger)',
        padding: '4px 8px',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        backdropFilter: 'blur(8px)',
        borderRadius: '4px',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        pointerEvents: 'auto',
        animation: 'fadeIn 0.2s ease-in-out',
        lineHeight: '1'
      }}
    >
      <svg
        style={{
          width: '12px',
          height: '12px',
          flexShrink: 0,
          display: 'block'
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      >
        <path d="M6 18L18 6M6 6l12 12" />
      </svg>
      <span style={{ display: 'block' }}>{text}</span>
    </div>
  );
}

/** Loading */
export function BadgeLoading({ text }: BadgeProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        color: 'var(--accent)',
        padding: '4px 8px',
        backgroundColor: 'rgba(var(--accent-rgb, 59, 130, 246), 0.1)',
        backdropFilter: 'blur(8px)',
        borderRadius: '4px',
        border: '1px solid rgba(var(--accent-rgb, 59, 130, 246), 0.3)',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        pointerEvents: 'auto',
        animation: 'fadeIn 0.2s ease-in-out',
        lineHeight: '1'
      }}
    >
      <svg
        style={{
          width: '12px',
          height: '12px',
          flexShrink: 0,
          display: 'block',
          animation: 'spin 1s linear infinite'
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
      <span style={{ display: 'block' }}>{text}</span>
    </div>
  );
}
