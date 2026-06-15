/*
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { ReactNode } from "react";

/** UI primitives built only from design-system tokens (classes in app.css). */

export function Eyebrow({
  children,
  signal = false,
}: {
  children: ReactNode;
  signal?: boolean;
}) {
  return (
    <p className={signal ? "eyebrow eyebrow--signal" : "eyebrow"}>{children}</p>
  );
}

export function SectionHead({
  eyebrow,
  title,
  signal = false,
  children,
}: {
  eyebrow: string;
  title: string;
  signal?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="section__head">
      <hr className="section__rule" />
      <Eyebrow signal={signal}>{eyebrow}</Eyebrow>
      <h2 className="t-h2">{title}</h2>
      {children ? <p className="t-body muted">{children}</p> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`panel ${className}`.trim()}>{children}</div>;
}

export function Stat({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: "pos" | "neg";
}) {
  const toneClass =
    tone === "pos" ? "delta-pos" : tone === "neg" ? "delta-neg" : "";
  return (
    <div className="stat">
      <p className="stat__label">{label}</p>
      <div className={`stat__value num ${toneClass}`.trim()}>
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {sub ? <div className="stat__sub">{sub}</div> : null}
    </div>
  );
}

export type BadgeTone =
  | "neutral"
  | "accent"
  | "signal"
  | "good"
  | "critical";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  const cls = tone === "neutral" ? "badge" : `badge badge--${tone}`;
  return <span className={cls}>{children}</span>;
}

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

export function SegToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ToggleOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="toggle" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="toggle__btn"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
