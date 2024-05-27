/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        "ibm-flex-mono": ["IBM Plex Mono", "sans-serif"],
      },
      fontSize: {
        12: "0.75rem",
        14: "0.875rem",
        16: "1rem",
        18: "1.125rem",
        20: "1.25rem",
        24: "1.5rem",
        26: "1.625rem",
        28: "1.75rem",
        32: "2rem",
        36: "2.25rem",
        44: "2.75rem",
        56: "3.5rem",
      },
      colors: {
        black: {
          4: "#F0F0F0",
          5: "#D9D9D9",
          6: "#BFBFBF",
          7: "#8C8C8C",
          8: "#595959",
          9: "#454545",
          10: "#262626",
          11: "#1F1F1F",
          "mid-night": "#121212",
        },
        blue: {
          "1A9ADA": "#1A9ADA",
          7: "#98D2EE",
          8: "#6ABDE7",
          10: "#3CA9E0",
        },
      },
      maxWidth: {
        container: "1160px",
      },
      backgroundImage: {
        primary: "linear-gradient(180deg, #121212 0%, #1A1A1A 100%)",
        "frosty-slate": "linear-gradient(180deg, #FFF 0%, #8B8B8B 100%)",
        "secondary-gradient":
          "linear-gradient(265deg, #E8F5FD 1.12%, rgba(232, 245, 253, 0.00) 98.37%)",
        "white-gradient":
          "linear-gradient(180deg, rgba(245, 245, 245, 0.00) 0%, #F5F5F5 7.88%, #F6FAFD 96.71%, rgba(245, 245, 245, 0.00) 100%)",
        "white-gradient-2": "linear-gradient(180deg, #FFF 0%, #DBDBDB 100%)",
        "white-gradient-3":
          "linear-gradient(180deg, #FFF 0%, rgba(219, 219, 219, 0.00) 100%)",
        "blue-gradient": "linear-gradient(137deg, #08C1EC 0%, #08C 100%)",
      },
      boxShadow: {
        1: "0px 4px 12px 0px rgba(0, 0, 0, 0.25)",
        2: "0px 4px 4px 0px rgba(0, 0, 0, 0.25)",
        3: "0px 4px 60px 0px rgba(0, 0, 0, 0.25)",
        4: "0px 3px 0px 0px #3D3D3D",
        5: "0px 4px 0px 0px rgba(0, 28, 48, 0.15)",
        6: "0px 6px 0px 0px #CBCBCB, 0px 2px 20px 0px rgba(0, 0, 0, 0.05)",
        7: "0px 2px 0px 0px #0D4D6D",
        8: "0px 4px 0px 0px #B5B5B5",
        9: "0px 2px 0px 0px rgba(0, 0, 0, 0.25)",
        10: "0px 20px 60px 0px rgba(0, 0, 0, 0.25), 0px 5px 0px 0px #004266",
      },
    },
  },
  plugins: [],
}
