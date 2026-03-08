import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Clerk
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("mock-token"),
    isSignedIn: true,
    userId: "user_test123",
  }),
  useUser: () => ({
    user: { id: "user_test123", firstName: "Test", lastName: "User" },
    isLoaded: true,
  }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: () => null,
}));

// Mock global fetch
global.fetch = vi.fn();
global.confirm = vi.fn(() => true);

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  global.confirm = vi.fn(() => true);
});
