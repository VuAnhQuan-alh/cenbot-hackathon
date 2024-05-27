import {
  cenBotLogo,
  discordIcon,
  mediumIcon,
  telegramIcon,
  twitterIcon,
} from "@assets/svg"
import { Link } from "react-router-dom"

const Footer = () => {
  return (
    <footer className="bg-[#141414] max-xl:px-2">
      <div className="max-w-container mx-auto pt-32 pb-5 xl:pt-[160px] xl:pb-20 relative">
        <div className="p-4 xl:py-9 xl:px-12 bg-blue-gradient absolute -top-20 xl:-top-[69px] w-full rounded-xl shadow-10 flex flex-col xl:flex-row justify-between items-center gap-4 z-10">
          <div className="max-w-[700px] max-xl:text-center space-y-3">
            <h3 className="font-medium text-white text-20 xl:text-28">
              [Cenbot]/ Native Telegram Bot on SUI
            </h3>
            <p className="text-black-4">
              Claim xCen and start your journey on SUI with Cenbot
            </p>
          </div>
          <a target="_blank" href="https://t.me/app_cenbot">
            {" "}
            <button className="btn-primary">Explore Now</button>
          </a>
        </div>

        <div className="flex flex-col justify-between w-full gap-4 mt-4 xl:flex-row">
          <div className="xl:max-w-[275px]">
            <img src={cenBotLogo} alt="" />
            <p className="mt-5 text-14 text-black-7">
              Built by community, owned by community
            </p>
          </div>

          <div className="flex flex-wrap justify-between flex-[2] gap-4">
            <div>
              <h4 className="mb-5 font-medium text-white text-16 xl:text-18">
                About
              </h4>
              <ul className="flex flex-col gap-4 text-14 text-black-7">
                <li>
                  <Link target="_blank" to="https://t.me/app_cenbot">
                    Create Wallet
                  </Link>
                </li>
                <li>
                  <Link target="_blank" to="https://t.me/app_cenbot">
                    Trading
                  </Link>
                </li>
                <li>
                  <Link target="_blank" to="https://t.me/app_cenbot">
                    Complete Tasks
                  </Link>
                </li>
                <li>
                  <Link target="_blank" to="https://t.me/app_cenbot">
                    Referral
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-5 font-medium text-white text-16 xl:text-18">
                xCen
              </h4>
              <ul className="flex flex-col gap-4 text-14 text-black-7">
                <li>
                  <a href="#earn">Earn xCen</a>
                </li>
                <li>
                  <a href="#faq">xCen Utility</a>
                </li>
                <li>
                  <a href="#leaderboard">Leaderboard</a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-5 font-medium text-white text-16 xl:text-18">
                Documents
              </h4>
              <ul className="flex flex-col gap-4 text-14 text-black-7">
                <li>
                  <Link target="_blank" to="https://docs.cenbot.org/">
                    Document
                  </Link>
                </li>
                <li>
                  <a href="#faq">FAQ</a>
                </li>
                <li>
                  <Link to="/">Branding Kit</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-start flex-1 md:items-end">
            <div className="">
              <h4 className="mb-5 font-medium text-white text-20">
                Connect with us
              </h4>
              <div>
                <ul className="flex gap-4 text-14 text-black-7">
                  {/* <li className="hover:scale-105">
                    <Link to="/">
                      <img src={mediumIcon} />
                    </Link>
                  </li> */}
                  <li className="hover:scale-105">
                    <a
                      href="https://twitter.com/CenbotOrg"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={twitterIcon} />
                    </a>
                  </li>
                  <li className="hover:scale-105">
                    <a
                      href="https://t.me/CenbotOrg"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={telegramIcon} />
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
