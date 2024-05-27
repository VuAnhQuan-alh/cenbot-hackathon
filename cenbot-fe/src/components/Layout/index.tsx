import Footer from "@components/Footer"
import Header from "@components/Header"
import React from "react"

interface Props {
  children: React.ReactNode
}

const Layout: React.FC<Props> = ({ children }) => {
  return (
    <div className="bg-[#F2FAFF]">
      <Header />
      {children}
      <Footer />
    </div>
  )
}

export default Layout
