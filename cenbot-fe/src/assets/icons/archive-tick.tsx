import React from "react"

function Icon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      fill="none"
      viewBox="0 0 48 48"
    >
      <g filter="url(#filter0_d_254_1021)">
        <path
          fill="#1A9ADA"
          d="M33.64 3.82H14.36c-4.24 0-7.72 3.48-7.72 7.72v28.18c0 3.6 2.58 5.12 5.74 3.38l9.76-5.42c1.04-.58 2.72-.58 3.74 0l9.76 5.42c3.16 1.76 5.74.24 5.74-3.38V11.54c-.02-4.24-3.48-7.72-7.74-7.72zm-2.4 14.24l-8 8c-.3.3-.68.44-1.06.44s-.76-.14-1.06-.44l-3-3c-.58-.58-.58-1.54 0-2.12.58-.58 1.54-.58 2.12 0l1.94 1.94 6.94-6.94c.58-.58 1.54-.58 2.12 0 .58.58.58 1.54 0 2.12z"
        ></path>
      </g>
      <defs>
        <filter
          id="filter0_d_254_1021"
          width="48"
          height="50"
          x="0"
          y="0"
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
          <feColorMatrix
            in="SourceAlpha"
            result="hardAlpha"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          ></feColorMatrix>
          <feOffset dy="2"></feOffset>
          <feComposite in2="hardAlpha" operator="out"></feComposite>
          <feColorMatrix values="0 0 0 0 0 0 0 0 0 0.3 0 0 0 0 0.45 0 0 0 1 0"></feColorMatrix>
          <feBlend
            in2="BackgroundImageFix"
            result="effect1_dropShadow_254_1021"
          ></feBlend>
          <feBlend
            in="SourceGraphic"
            in2="effect1_dropShadow_254_1021"
            result="shape"
          ></feBlend>
        </filter>
      </defs>
    </svg>
  )
}

export default Icon
