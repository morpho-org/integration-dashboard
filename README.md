# Morpho Integration Dashboard

A Next.js dashboard for Morpho integration and manual reallocation operations.

## Getting Started

### Prerequisites

- Node.js >=22.13 <23
- pnpm 11.0.9 (the commands below use `npx`)

### Installation

```bash
npx -y pnpm@11.0.9 install
```

### Development

```bash
npx -y pnpm@11.0.9 run dev
```

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Production Build

```bash
npx -y pnpm@11.0.9 run build
npx -y pnpm@11.0.9 run start
```

### Linting

```bash
npx -y pnpm@11.0.9 run lint
```

### Tests

```bash
npx -y pnpm@11.0.9 run test
npx -y pnpm@11.0.9 run test:public-allocator
```

## Tech Stack

- Next.js 15
- React 18
- TypeScript
- Tailwind CSS
- Wagmi / Viem
- RainbowKit
- Morpho SDK
