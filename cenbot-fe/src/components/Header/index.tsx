import { cenBotLogo } from "@assets/images"
import { IconTelegram, IconTwitter } from "@assets/index"
import {
  discordIcon,
  hamburgerMenuIcon,
  telegramIcon,
  twitterIcon,
} from "@assets/svg"
import Drawer from "@components/Drawer"
import { Menu, Transition } from "@headlessui/react"
import useWindowSize from "@hooks/useWindowSize"
import { Fragment, useState } from "react"
import { RiArrowDropDownLine } from "react-icons/ri"
import { Link } from "react-router-dom"

const navList = [
  {
    name: "Home",
    href: "#home",
  },
  // {
  //   name: "About",
  //   href: "#about",
  // },
  {
    name: "Community",
    href: "#community",
  },
  {
    name: "Solutions",
    href: "#solutions",
  },
  // {
  //   name: "Contact US",
  //   href: "#contact",
  // },
]

const Nav = () => {
  return (
    <nav>
      <ul className="flex flex-col gap-4 font-medium xl:flex-row xl:items-center text-16 text-black-mid-night xl:gap-11">
        {navList.map((nav, index) => {
          if (nav.name === "Community") {
            return (
              <Menu
                as="li"
                className="relative inline-block text-left"
                key={index}
              >
                <Menu.Button className="flex items-center justify-center gap-x-2">
                  {nav.name} <RiArrowDropDownLine />
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute left-0 mt-2 origin-top-right bg-white divide-y divide-gray-100 rounded-md shadow-lg w-fit focus:outline-none">
                    <div className="px-1 py-1 space-y-1">
                      <Menu.Item>
                        {() => (
                          <a
                            href="https://twitter.com/CenbotOrg"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 px-2 py-2 rounded hover:bg-blue-1A9ADA group"
                          >
                            <div className="scale-95 group-hover:hidden">
                              <IconTwitter color="#000" />
                            </div>
                            <div className="hidden scale-95 group-hover:block">
                              <IconTwitter />
                            </div>
                            <span className="text-sm text-black group-hover:text-white">
                              Twitter
                            </span>
                          </a>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {() => (
                          <a
                            href="https://t.me/CenbotOrg"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 px-2 py-2 rounded hover:bg-blue-1A9ADA group"
                          >
                            <div className="scale-95 group-hover:hidden">
                              {" "}
                              <IconTelegram color="#000" />
                            </div>
                            <div className="hidden scale-95 group-hover:block">
                              <IconTelegram />
                            </div>
                            <span className="text-sm text-black group-hover:text-white">
                              Telegram
                            </span>
                          </a>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>
            )
          }
          return (
            <li key={index}>
              <Link to={nav.href}>{nav.name}</Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

const Header = () => {
  const { width } = useWindowSize()
  const [openDrawer, setOpenDrawer] = useState<boolean>(false)

  return (
    <header className="w-full fixed top-0 bg-[#F2FAFF]/70 z-[999] max-xl:px-2">
      <div className="flex items-center justify-between py-4 mx-auto xl:py-6 max-w-container">
        <img src={cenBotLogo} alt="" className="w-[162px]" />
        {width > 1279 && <Nav />}
        <div className="flex items-center gap-2">
          <a target="_blank" href="https://t.me/app_cenbot">
            <button className="btn-secondary w-fit xl:w-[162px] rounded-full">
              Try Cenbot
            </button>
          </a>
          {width < 1280 && (
            <button type="button" onClick={() => setOpenDrawer(true)}>
              <img src={hamburgerMenuIcon} alt="" />
            </button>
          )}
        </div>
      </div>
      {width < 1280 && (
        <Drawer isOpen={openDrawer} closeDrawer={() => setOpenDrawer(false)}>
          <Nav />
        </Drawer>
      )}
    </header>
  )
}

export default Header
