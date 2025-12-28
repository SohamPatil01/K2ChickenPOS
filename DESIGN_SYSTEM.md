# AzelaPOS Design System

## 🎨 Orange-Based Premium Design System

A complete, modern design system built for a SaaS/POS/Franchise Management application with Apple/Stripe/Linear quality standards.

---

## 📦 Color Palette

### Primary Brand (Orange Spectrum)
- `brand-900`: `#7A2E00` - Deep burnt orange
- `brand-800`: `#9A3E00`
- `brand-700`: `#C04A00`
- `brand-600`: `#E65C00`
- `brand-500`: `#FF6A00` - **PRIMARY BRAND COLOR**
- `brand-400`: `#FF8A3D`
- `brand-300`: `#FFB37A`
- `brand-200`: `#FFD5B3`
- `brand-100`: `#FFF0E6`

### Accent Colors
- `accent-success`: `#16A34A` - Green
- `accent-warning`: `#FACC15` - Yellow
- `accent-danger`: `#DC2626` - Red
- `accent-info`: `#2563EB` - Blue

### Neutrals
- `neutral-black`: `#0F0F0F`
- `neutral-gray900`: `#181818`
- `neutral-gray700`: `#2A2A2A`
- `neutral-gray500`: `#6B7280`
- `neutral-gray300`: `#D1D5DB`
- `neutral-gray100`: `#F5F5F5`
- `neutral-white`: `#FFFFFF`

---

## 🎯 Components

### Button

```tsx
import { Button } from '@/components/ui';

// Primary (Orange)
<Button variant="primary">Save Changes</Button>

// Secondary (Outlined)
<Button variant="secondary">Cancel</Button>

// Ghost
<Button variant="ghost">Learn More</Button>

// Danger
<Button variant="danger">Delete</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>

// Loading state
<Button isLoading>Processing...</Button>
```

**Features:**
- Hover: Elevates with shadow and slight translate
- Active: Inset shadow for pressed effect
- Disabled: Muted colors with not-allowed cursor
- Focus: Ring outline for accessibility

### Card

```tsx
import { Card } from '@/components/ui';

// Default
<Card>Content here</Card>

// With accent line
<Card hasAccent>Content with orange top accent</Card>

// Elevated (with hover glow)
<Card variant="elevated">Hover for orange glow</Card>

// Bordered
<Card variant="bordered">Bordered card</Card>
```

### Input

```tsx
import { Input } from '@/components/ui';

// Basic
<Input placeholder="Enter name" />

// With label
<Input label="Email" type="email" required />

// With error
<Input label="Password" error="Password is required" />

// With helper text
<Input label="Username" helperText="Choose a unique username" />
```

**Features:**
- Focus: Orange border with glow shadow
- Error: Red border with error shadow
- Disabled: Gray background, muted text

---

## 🎭 Shadows

### Card Shadow
```css
box-shadow: 0px 6px 20px rgba(0, 0, 0, 0.08);
```
- Used for: Cards, panels, elevated surfaces

### Orange Glow
```css
box-shadow: 0px 10px 30px rgba(255, 106, 0, 0.4);
```
- Used for: Important CTAs, hover states on elevated cards

### Input Focus Glow
```css
box-shadow: 0px 0px 0px 3px rgba(255, 106, 0, 0.35);
```
- Used for: Focused input fields

### Button Hover Shadow
```css
box-shadow: 0px 8px 24px rgba(255, 106, 0, 0.35);
```
- Used for: Primary button hover states

---

## 📐 Spacing & Sizing

### Border Radius
- `rounded-[10px]` - Inputs
- `rounded-xl` (12px) - Buttons
- `rounded-xl2` (16px) - Cards

### Padding
- Inputs: `12px 14px`
- Buttons: `12px 18px`
- Cards: `20px`

---

## ⚡ Animations

### Standard Transition
```css
transition: all 180ms ease-out;
```

### Button Hover
- Scale: `1.02` (via translateY)
- Shadow: Orange glow appears
- Duration: `180ms`

### Card Hover
- Shadow increases (orange glow on elevated)
- Border accent glows brand-500
- Duration: `180ms`

---

## 🌙 Dark Mode

Dark mode is automatically supported via CSS media queries:

```css
@media (prefers-color-scheme: dark) {
  /* Automatic dark mode styling */
}
```

**Dark Mode Colors:**
- Background: `#0B0B0B`
- Surface: `#181818`
- Text Primary: `#FFFFFF`
- Text Secondary: `#D1D5DB`

Buttons remain brand-500 for consistency in both modes.

---

## 📱 Responsive Design

All components are mobile-first and fully responsive:

- **Mobile**: Stacked layouts, full-width buttons
- **Tablet**: Side-by-side where appropriate
- **Desktop**: Optimal spacing and grid layouts

---

## 🎨 Typography

### Font Family
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
```

### Font Weights
- Normal: `400`
- Medium: `500`
- Semibold: `600` (buttons)
- Bold: `700` (headings)

### Colors
- Headings: `neutral-gray900` (dark: white)
- Body: `neutral-gray700` (dark: `neutral-gray300`)
- Links: `brand-500` with hover `brand-600`

---

## 🚀 Usage Examples

### Complete Form Example

```tsx
import { Card, Input, Button } from '@/components/ui';

<Card hasAccent>
  <h2 className="text-2xl font-bold mb-4">Create Account</h2>
  
  <form className="space-y-4">
    <Input
      label="Full Name"
      placeholder="John Doe"
      required
    />
    
    <Input
      label="Email"
      type="email"
      placeholder="john@example.com"
      required
    />
    
    <Input
      label="Password"
      type="password"
      error={errors.password}
      helperText="Minimum 8 characters"
    />
    
    <div className="flex gap-3 pt-4">
      <Button variant="secondary">Cancel</Button>
      <Button variant="primary" isLoading={isSubmitting}>
        Create Account
      </Button>
    </div>
  </form>
</Card>
```

---

## 📚 Tailwind Classes

### Brand Colors
```tsx
<div className="bg-brand-500 text-white">Primary</div>
<div className="text-brand-600">Link</div>
<div className="bg-brand-100">Light background</div>
```

### Shadows
```tsx
<div className="shadow-card">Card</div>
<div className="shadow-orangeGlow">Glowing element</div>
<div className="shadow-inputFocus">Focused input</div>
```

### Utilities
```tsx
<div className="transition-standard">Smooth transition</div>
<div className="rounded-xl2">Large radius</div>
```

---

## ✅ Design Principles

1. **Premium Feel**: Soft shadows, smooth animations, careful spacing
2. **Clean & Readable**: High contrast, clear hierarchy
3. **Mobile-First**: Responsive by default
4. **Accessible**: Focus states, proper contrast ratios
5. **Consistent**: Single source of truth for all design tokens

---

## 🔧 Customization

All design tokens are centralized in:
- `packages/shared/src/theme.ts` - Theme configuration
- `apps/*/tailwind.config.ts` - Tailwind extensions
- `apps/*/src/app/globals.css` - CSS variables

Modify these files to customize the design system.

