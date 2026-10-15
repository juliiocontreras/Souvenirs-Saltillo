export default function Icon({ name, size = 24, ...props }) {
  const paths = {
    search: (
      <>
        <circle cx="10.75" cy="10.75" r="6.75" />
        <path d="m16 16 5 5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7.5" r="3.5" />
        <path d="M5 21v-2.5a7 7 0 0 1 14 0V21Z" />
      </>
    ),
    arrow: <path d="M3 12h17M14 6l6 6-6 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    gift: (
      <>
        <path d="M4 10h16v4H4zM6 14v7h12v-7M12 10v11" />
        <path d="M12 10C5 10 5 3 8.5 3 12 3 12 10 12 10Zm0 0s0-7 3.5-7C19 3 19 10 12 10Z" />
      </>
    ),
    pencil: (
      <>
        <path d="m15 4 5 5M4 20l1-6L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L10 19Z" />
        <path d="m5 14 5 5" />
      </>
    ),
    sprig: (
      <>
        <path d="M12 22V8M12 15C5 15 4 12 4 9c5 0 8 2 8 6Zm0 5c7 0 8-3 8-6-5 0-8 2-8 6ZM12 9c-5-4-3-6 0-8 3 2 5 4 0 8Z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name] || paths.gift}
    </svg>
  );
}
export function Wordmark({ footer = false }) {
  return (
    <a
      className={"sf-wordmark" + (footer ? " sf-wordmark-footer" : "")}
      href="/"
      aria-label="Souvenirs Saltillo, inicio"
    >
      <img
        className="sf-logo"
        src="/images/souvenirs-saltillo-logo.webp"
        alt="Souvenirs Saltillo"
        width="665"
        height="221"
      />
    </a>
  );
}
