import React from "react"

interface Props {
  children: React.ReactNode
  isOpen: boolean
  closeDrawer: () => void
}

const Drawer: React.FC<Props> = ({ isOpen, closeDrawer, children }) => {
  return (
    <>
      <div
        onClick={closeDrawer}
        aria-expanded={isOpen}
        className="w-0 h-auto bg-black-mid-night/70 inset-0 aria-expanded:fixed aria-expanded:w-full aria-expanded:h-full"
      />
      <div
        aria-expanded={isOpen}
        className="w-0 absolute inset-y-0 right-0 bg-[#F2FAFF] p-6 aria-expanded:w-[280px] h-[100dvh] transition-all duration-300 ease-in-out translate-x-full aria-expanded:translate-x-0 z-50 group"
      >
        <div className="mb-4">
          <button type="button" onClick={closeDrawer}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
            >
              <path
                fill="black"
                d="M19.293 6.293L12 13.586 4.707 6.293 3.293 7.707 10.586 15 3.293 22.293 4.707 23.707 12 16.414 19.293 23.707 20.707 22.293 13.414 15 20.707 7.707z"
              />
            </svg>
          </button>
        </div>
        <div className="hidden group-aria-expanded:block">{children}</div>
      </div>
    </>
  )
}

export default Drawer
