function Icon({ color = "#3CA9E0" }: { color?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      fill="none"
      viewBox="0 0 20 20"
    >
      <path fill="#D9D9D9" d="M4.8 15.6h10.4V4.4H4.8v11.2z"></path>
      <path
        fill={color}
        d="M10 2c-4.408 0-8 3.592-8 8 0 4.408 3.592 8 8 8 4.408 0 8-3.592 8-8 0-4.408-3.592-8-8-8zm3.824 6.16l-4.536 4.536a.6.6 0 01-.848 0l-2.264-2.264a.604.604 0 010-.848.604.604 0 01.848 0l1.84 1.84 4.112-4.112a.604.604 0 01.848 0 .604.604 0 010 .848z"
      ></path>
    </svg>
  )
}

export default Icon
