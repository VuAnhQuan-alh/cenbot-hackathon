import {
  dropletsWaterImg,
  flowArrowImg,
  nftCardsImg,
  partners1,
  partners2,
  partners3,
  partners4,
  partners5,
  partners6,
  partners7,
  suiSpin,
  twelveGame,
  // pn1Img,
  // pn2Img,
  // pn3Img,
  // pn4Img,
  // pn5Img,
  // pn6Img,
  waterWaveImg,
  wave2Img,
  waveBg,
} from "@assets/images"
import {
  ArchiveTickIcon,
  IconCup,
  IconGame,
  IconSend,
  PersentionChartIcon,
  ReceiptIcon,
  StatusUpIcon,
  TaskSquareIcon,
  TickCircleIcon,
  TicketStarIcon,
  WalletIcon,
} from "@assets/index"
import {
  archiveTickBlueIcon,
  boxIcon,
  frameBottomLeftIcon,
  frameBottomRightIcon,
  frametopLeftIcon,
  frametopRightIcon,
  likeDislikeIcon,
  peopleIcon,
  statusUpBlueIcon,
  taskIcon,
  taskSquareIcon,
  tickCircleDarkIcon,
  ticketStarIcon,
  walletIcon,
  xLogo,
} from "@assets/svg"
import Accordion from "@components/Accordion"
import Layout from "@components/Layout"
import Loader from "@components/loading/loader"
import { RankingLeaderboardProps } from "interfaces"
import { ReactNode, useEffect, useState } from "react"
import { getRankingLeaderboard } from "services"

const accordions = [
  {
    title: "What is xCen?",
    content:
      "xCen is a testament to the decentralized power of the community over Cenbot. Each individual owning xCen is equivalent to owning a portion of Cenbot, and they are one of the individuals contributing to the ongoing development of Cenbot day by ",
  },
  {
    title: "Why xCen is special?",
    content: `
        <li>xCen signifies a shift away from centralized authority and helps build a multi-faceted environment where individuals own a stake in Cenbot, actively contributing to its daily development.</li>
  <li>Referring to xCen as a system of proof for decentralized community power suggests that each individual possessing xCen is equivalent to owning a share of Cenbot. They become integral contributors to the ongoing construction of Cenbot every day.</li>
  <li>This messaging not only celebrates community contributions but also underscores the decentralized nature of power within the community. It promotes a communal spirit, where everyone plays a part in the project's growth. This can instill strong commitment and loyalty within the community towards Cenbot.</li>
  <li>xCen isn't just a symbol of power; it's also evidence of a decentralized business model, where value is generated and shared fairly. Each individual owning xCen is not merely a user but a stakeholder, influencing decisions and the project's trajectory.</li>
  <li>In this way, Cenbot becomes more than just an application; it transforms into a community actively constructing a decentralized ecosystem, fostering creativity and harnessing community strength to make the platform increasingly robust and adaptable.</li>

     `,
  },
  {
    title: "How to earn xCen?",
    content: `
     <li>Enter Referral Code from Inviter: Input the referral code shared by the inviter during the registration process.</li>

     <li>Share Your Referral Code: Share your own referral code with others, encouraging them to join Cenbot using your code.</li>
     
     <li>Deposit Tokens into Cenbot Wallet: Earn xCen by depositing tokens into your Cenbot wallet.</li>
     
     <li>Hashtag (X | Twitter) Count: Participate in Twitter campaigns with designated hashtags, earning points based on your activity.</li>
     
     <li>Complete Daily Tasks: Engage in and fulfill daily tasks specified by Cenbot to accumulate additional points.</li>
     
     <li>Receive Points after Each Swap Transaction with Cenbot: Earn points for every swap transaction conducted through Cenbot.</li>
     `,
  },
  {
    title: "What can we do with xCen?",
    content: `
     <li>With xCen, you become stakeholders of Cenbot, implying partial ownership of the platform. The more xCen you possess, the greater influence you wield.</li>

     <li>xCen empowers you to vote on strategic decisions and crucial updates that impact the Cenbot community, including yourself.</li>
     
     <li>A little sneak peek: xCen serve as the key to participating in Cenbot's fully on-chain casual games. Stay tuned for exciting developments!</li>
     
     <li>xCen are not just a symbol of power but also signify decentralization and the community's commitment to Cenbot. The benefits surrounding xCen will grant you exclusive access to undisclosed advantages secrets that are sure to exceed your expectations.</li>
     
     <li>While people may talk about Airdrops, but not just only that. We'd like to draw your attention to the concept of "Convert Rate". Beyond mere Airdrops, this represents a dynamic aspect that holds potential surprises. Stay tuned for further revelations!</li>
     `,
  },
  {
    title:
      "Does the quantity of xCen that the community receives change over time?",
    content: `
      <li>The Earning xCen system will undergo changes over time:</li>
<li>In the following phrases, the point coefficients that the community receives through activities on Cenbot will experience a gradual shift. This involves a reduction in the referral point mechanism and an increase in the point-earning ratio for community activities on Cenbot, including Social Tasks within Daily Tasks.</li>

<li>The essence of this shift is to establish a balanced mechanism for xCen, mitigating inflationary tendencies and encouraging the community to utilize more features within Cenbot. Specific details regarding the changes in the point-earning ratios for various activities will be accurately updated in the documentation.</li>
      `,
  },
  {
    title: "How many xCen will I get for each tasks?",
    content: `
      `,
  },
]

// const Divider = () => (
//   <div className="w-full divide-x h-[1px] bg-black-11 my-10 xl:my-24" />
// )

const points = [
  {
    icon: <TaskSquareIcon />,
    title: "Complete Tasks",
    descList: ["Social Interaction", "In-app Interaction", "Referral"],
  },
  {
    icon: <ReceiptIcon />,
    title: "Claim xCen",
    descList: [
      "Each Social Interaction",
      "Each In-app Interaction",
      "Each Referral",
    ],
  },
  {
    icon: <WalletIcon />,
    title: "Revenue Sharing",
    descList: ["Swap Fee", "NFT Loyalty Fee", "Incentive Reward"],
  },
  {
    icon: <TicketStarIcon />,
    title: "Optimize Cenbot",
    descList: ["Join Cenbot To Break Limits"],
  },
]

const tradingSolution = [
  {
    icon: <ArchiveTickIcon />,
    title: "Maximum Convenience",
    desc: "Swap process on Cenbot is designed to be straightforward and efficient, optimizing user experience.",
  },
  {
    icon: <StatusUpIcon />,
    title: "Market Insight",
    desc: "Tracking market insights, providing timely updates and analysis to help you stay informed and make informed decisions.",
  },
  {
    icon: <PersentionChartIcon />,
    title: "Token snipe",
    desc: "Streamlining token-sniping process with simple, user-friendly steps, making it easy to acquire the popular tokens.",
  },
]

const nftSolution = [
  {
    title: "NFT Tracking Tool",
    child: [
      "Update Floor price",
      "NFT trading transactions/ Volume",
      "KOL/Collection Alert",
    ],
  },
  {
    title: "CENBOT NFT Collections",
  },
  {
    title: "NFTfi",
  },
]

const gamehub = [
  {
    title: "SUI Spin",
    img: suiSpin,
  },
  {
    title: "Twelve Olympians",
    img: twelveGame,
  },
]

const gameHubList = [
  {
    title: "More than 10+ games",
    icon: <IconCup />,
  },
  {
    title: "Telegram Game Center",
    icon: <IconSend />,
  },
  {
    title: "On-Chain & Open world Game Center",
    icon: <IconGame />,
  },
]

const partnersList = [
  partners1,
  partners2,
  partners3,
  partners4,
  partners5,
  partners6,
  partners7,
  partners5,
  partners4,
  partners3,
]

const TitleWrap = ({
  title = "",
  isUpper = false,
}: {
  title: string
  isUpper?: boolean
}) => {
  return (
    <div className="relative flex items-center mx-4 h-14 w-fit xl:px-6 xl:mx-auto">
      <img src={frametopLeftIcon} className="absolute top-0 -left-3" />
      <img src={frametopRightIcon} className="absolute top-0 -right-3" />
      <img src={frameBottomLeftIcon} className="absolute bottom-0 -left-3" />
      <img src={frameBottomRightIcon} className="absolute bottom-0 -right-3" />
      <h2
        className={`text-20 xl:text-26 font-semibold text-center ${
          isUpper && "uppercase"
        }`}
      >
        {title}
      </h2>
    </div>
  )
}

const Home = () => {
  const [listRankLeaderboard, setListRankLeaderboard] = useState<
    RankingLeaderboardProps[]
  >([])

  const handleGetRank = async () => {
    const data = await getRankingLeaderboard()
    setListRankLeaderboard(data)
  }

  useEffect(() => {
    handleGetRank()
  }, [])

  console.log({ listRankLeaderboard })

  return (
    <Layout>
      <div
        style={{
          backgroundImage: `url(${waveBg})`,
        }}
        className="bg-no-repeat bg-cover w-full h-[1605px] absolute inset-0"
      />
      <div id="earn" className="relative z-10 w-full h-full">
        <div className="w-full h-full pb-28 xl:pb-52">
          <div className="max-xl:px-2 my-[166px] mb-[90px] flex flex-col items-center justify-start">
            <h1 className="italic font-semibold text-center text-black-mid-night text-32 xl:text-36">
              Cenbot Native Telegram Bot on{" "}
              <span className="not-italic font-semibold text-32 xl:text-36 text-blue-1A9ADA">
                SUI BLOCKCHAIN
              </span>
            </h1>
            <p className="text-16 xl:text-18 text-black-8 max-w-[550px] mx-auto mt-3 text-center">
              In Cenbot, we believe in the power of decentralize Built for
              community, owned by community
            </p>
            <div className="flex items-center justify-center gap-2 mt-10 xl:gap-5">
              <a target="_blank" href="https://t.me/app_cenbot">
                <button className="px-2 btn-secondary xl:px-4">
                  Claim xCen
                </button>
              </a>
              <a target="_blank" href="https://t.me/app_cenbot">
                <button className="px-2 btn-secondary xl:px-4">
                  Trade Now
                </button>
              </a>
              <a target="_blank" href="https://t.me/app_cenbot">
                <button className="px-2 btn-secondary xl:px-4">
                  Explore More
                </button>
              </a>
            </div>
          </div>

          <div>
            <TitleWrap title="CLAIM YOUR xCen AND BECOME CENBOT OWNERS" />
            <div className="bg-[rgba(217,217,217,0.20)] py-4 px-2 xl:py-10 xl:px-14 rounded-2xl max-w-[787px] mx-auto mt-6 flex flex-col items-center shadow-5 backdrop-blur-[10px] max-xl:mx-2">
              <div className="flex items-center w-full mb-4 xl:gap-4">
                <img src={flowArrowImg} className="h-[416px]" />
                <div className="w-full space-y-2">
                  {points.map((item, index) => (
                    <div
                      className="flex items-center justify-between h-auto gap-3 p-2 rounded-lg bg-white/60 xl:p-4 backdrop-blur-sm"
                      key={index}
                    >
                      <div className="flex items-center flex-1 gap-2 xl:gap-4">
                        {/* <img
                          src={item.icon}
                          className="w-8 h-8 xl:w-12 xl:h-12"
                        /> */}
                        <div>{item.icon}</div>
                        <span className="font-semibold text-14 xl:text-18 text-black-10">
                          {item.title}
                        </span>
                      </div>
                      <ul className="flex-[1.5] space-y-2">
                        {item.descList.map((desc, idx) => (
                          <li className="flex items-center gap-2" key={idx}>
                            <TickCircleIcon />
                            <span className="font-medium text-12 xl:text-16 text-black-10">
                              {desc}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
              <a target="_blank" href="https://t.me/app_cenbot">
                <button className="btn-primary">Explore xCen</button>
              </a>
            </div>
          </div>

          <div className="py-10 bg-white xl:py-20 max-xl:px-2">
            <div className="flex flex-col items-center mx-auto max-w-container">
              <TitleWrap isUpper title="Trading Solutions" />
              <div className="flex gap-5 mt-10 xl:mt-16 max-xl:flex-col">
                {tradingSolution.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-white shadow-6 flex-1 flex flex-col items-center max-xl:text-center xl:items-start border-[2px]"
                  >
                    {/* <img
                    src={archiveTickBlueIcon}
                    alt=""
                    className="w-6 h-6 xl:w-12 xl:h-12"
                  /> */}
                    {item.icon}
                    <h4 className="mt-2 mb-1 font-semibold text-16 xl:text-18 text-black-10 xl:mt-4">
                      {item.title}
                    </h4>
                    <p className="text-black-10">{item.desc}</p>
                  </div>
                ))}
              </div>
              <a target="_blank" href="https://t.me/app_cenbot">
                <button className="mx-auto mt-10 btn-primary xl:mt-12">
                  Trade Now
                </button>
              </a>
            </div>
          </div>
          <div className="pt-5 pb-20 bg-white">
            <div className="flex items-center justify-between mx-auto max-w-container md:items-start max-md:flex-col-reverse">
              <div className="flex flex-col justify-center flex-1 gap-4 pt-5 xl:gap-12 max-xl:mt-10 max-xl:items-center max-xl:px-2">
                {/* <h3 className="font-semibold text-18 xl:text-24 text-black-mid-night">
                  Loyalty NFT Collections
                </h3> */}
                <div className="flex items-center justify-start w-fit">
                  <TitleWrap isUpper title="NFT SOLUTIONS" />
                </div>
                <div className="space-y-6">
                  {nftSolution.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-start gap-x-4">
                        <div className="mt-1">
                          <TickCircleIcon color="#121212" />
                        </div>
                        <p className="text-lg font-semibold">
                          {item.title}
                          {item.child && (
                            <div className="text-base font-normal">
                              {item.child.map((i, index) => (
                                <li key={index}>{i}</li>
                              ))}
                            </div>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* <div className="flex flex-col gap-3 xl:gap-6">
                  <div className="flex items-center gap-2 xl:gap-4">
                    <img
                      src={tickCircleDarkIcon}
                      className="w-6 h-6 xl:w-8 xl:h-8"
                    />
                    <span className="text-black-10">
                      Affirmation of commitment to contribute
                    </span>
                  </div>
                  <div className="flex items-center gap-2 xl:gap-4">
                    <img
                      src={tickCircleDarkIcon}
                      className="w-6 h-6 xl:w-8 xl:h-8"
                    />
                    <span className="text-black-10">
                      Show off the extraordinaryness of Cenbot
                    </span>
                  </div>
                  <div className="flex items-center gap-2 xl:gap-4">
                    <img
                      src={tickCircleDarkIcon}
                      className="w-6 h-6 xl:w-8 xl:h-8"
                    />
                    <span className="text-black-10 max-w-[470px]">
                      Completely belong to the community, the most outstanding
                      members of Cenbot
                    </span>
                  </div>
                </div> */}

                <button className="btn-primary">Explore (Soon)</button>
              </div>
              <img src={nftCardsImg} className="h-[240px] xl:h-[486px]" />
            </div>
          </div>
          <div className="bg-secondary-gradient h-[785px] xl:h-[585px] flex xl:justify-between xl:gap-40 border border-[#B4E3FC] max-xl:flex-col-reverse ">
            <div
              style={{
                backgroundImage: `url(${waterWaveImg})`,
              }}
              className="relative flex items-center justify-center flex-1 bg-center bg-no-repeat bg-cover xl:justify-end"
            >
              <div className="bg-white/70 px-[30px] max-md:my-5 flex items-center justify-center max-md:flex-col py-3 w-fit rounded-[20px] relative z-[9000] gap-5">
                {gamehub.map((item, idx) => (
                  <div
                    className="flex flex-col items-center mt-3 gap-y-3"
                    key={idx}
                  >
                    <h3 className="font-semibold md:text-lg">{item.title}</h3>
                    <img
                      className="relative hover:scale-[1.02] transition-all duration-150 z-[9000] max-md:w-1/2"
                      src={item.img}
                      alt=""
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-center items-center flex-1 gap-4 xl:gap-12 max-xl:px-2 max-xl:items-center">
              <h3 className="font-semibold uppercase text-18 xl:text-24 text-black-mid-night max-xl:text-center">
                CENBOT gAMEHUB
              </h3>

              <div className="flex flex-col gap-3 xl:gap-6">
                {gameHubList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 xl:gap-4">
                    <div>{item.icon}</div>
                    <span className="text-black-10">{item.title}</span>
                  </div>
                ))}
              </div>

              <button className="btn-primary">Play (Soon)</button>
            </div>
          </div>
          <div id="leaderboard" className="bg-[#F2FAFF] xl:pt-[108px]">
            <div className="relative py-20 xl:pt-16 xl:pb-20">
              <div className="max-w-[766px] mx-auto flex flex-col items-center max-xl:px-2">
                <TitleWrap title="Glory Leaderboard" />
                <div className="flex w-full gap-4 mt-10 mb-4 xl:mt-14 xl:items-end max-xl:flex-col">
                  <div className="p-4 bg-blue-8 rounded-lg flex flex-col justify-between min-h-[215px] flex-1">
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <img
                          src={listRankLeaderboard[1]?.avatar ?? xLogo}
                          className="w-10 h-10 rounded-full"
                        />
                        <h5 className="font-semibold text-white text-18">
                          {/* <Loader width={100} /> */}
                          {listRankLeaderboard[1]?.username}
                        </h5>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-white">
                          {/* <Loader width={100} /> */}
                          {listRankLeaderboard[1]?.code}
                        </span>
                        <span className="text-white">
                          {/* <Loader width={100} /> */}
                          {listRankLeaderboard[1]?.point}
                        </span>
                      </div>
                    </div>

                    <div className="h-10 w-12 bg-white-gradient-2 shadow-7 rounded border border-[#4545451A] flex justify-center items-center">
                      <span className="font-semibold">2</span>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-10 rounded-lg flex flex-col justify-between min-h-[237px] flex-1">
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <img
                          src={listRankLeaderboard[0]?.avatar ?? xLogo}
                          className="w-10 h-10 rounded-full"
                        />
                        <h5 className="font-semibold text-white text-18">
                          {/* <Loader width={100} /> */}
                          {listRankLeaderboard[0]?.username}
                        </h5>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-white">
                          {/* <Loader width={100} /> */}
                          {listRankLeaderboard[0]?.code}
                        </span>
                        <span className="text-white">
                          {/* <Loader width={100} /> */}
                          {listRankLeaderboard[0]?.point}
                        </span>
                      </div>
                    </div>

                    <div className="h-10 w-12 bg-white-gradient-2 shadow-7 rounded border border-[#4545451A] flex justify-center items-center">
                      <span className="font-semibold">1</span>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-7 rounded-lg flex flex-col justify-between min-h-[200px] flex-1">
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <img
                          src={listRankLeaderboard[2]?.avatar ?? xLogo}
                          className="w-10 h-10 rounded-full"
                        />
                        <h5 className="font-semibold text-white text-18">
                          {/* <Loader width={100} /> */}
                          {listRankLeaderboard[2]?.username}
                        </h5>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-white">
                          {/* <Loader width={100} /> */}
                          {listRankLeaderboard[2]?.code}
                        </span>
                        <span className="text-white">
                          {/* <Loader width={100} /> */}
                          {listRankLeaderboard[2]?.point}
                        </span>
                      </div>
                    </div>

                    <div className="h-10 w-12 bg-white-gradient-2 shadow-7 rounded border border-[#4545451A] flex justify-center items-center">
                      <span className="font-semibold">3</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col w-full gap-4">
                  {Array.from({ length: 7 }, (_, item) => (
                    <div
                      className="flex items-center justify-between gap-1 p-2 py-3 border rounded xl:px-4 bg-white-gradient-3 shadow-8"
                      key={item}
                    >
                      <div className="flex items-center gap-8 w-1/4">
                        <img
                          src={listRankLeaderboard[item + 3]?.avatar ?? xLogo}
                          alt=""
                          className="w-6 h-6 xl:w-9 xl:h-9 rounded-full"
                        />
                        <span>
                          {/* <Loader width={100} background="rgb(71, 85, 105)" /> */}
                          {listRankLeaderboard[item + 3]?.username}
                        </span>
                      </div>
                      <span className="">
                        {/* <Loader width={100} background="rgb(71, 85, 105)" /> */}
                        {listRankLeaderboard[item + 3]?.code}
                      </span>
                      <span>
                        {/* <Loader width={100} background="rgb(71, 85, 105)" /> */}
                        {listRankLeaderboard[item + 3]?.point}
                      </span>
                      <div className="flex items-center justify-center w-8 py-1 border rounded xl:py-2 bg-black-4 shadow-9 xl:w-12 border-black-9/10">
                        <span>{item + 4}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <a target="_blank" href="https://t.me/app_cenbot">
                  {" "}
                  <button className="mt-8 btn-primary">Explore Rank</button>
                </a>
                <img
                  src={wave2Img}
                  className="w-[505px] h-auto absolute bottom-0 right-0 max-xl:hidden"
                />
              </div>
            </div>

            {/* <div className="pt-20 xl:pt-[120px] flex flex-col items-center">
              <TitleWrap title="Partners" />
              <div className="flex flex-wrap justify-between py-10 mx-auto bg-white-gradient-3 max-w-container">
                {partners.map((partner) => (
                  <img src={partner} className="w-1/2 xl:w-[232px]" />
                ))}
              </div>
            </div> */}
          </div>
          <div className="bg-secondary-gradient h-[650px] xl:h-[585px] flex xl:justify-between xl:gap-16 border border-[#B4E3FC] max-xl:flex-col">
            <div
              style={{
                backgroundImage: `url(${waterWaveImg})`,
              }}
              className="relative flex-1 bg-center bg-no-repeat bg-cover"
            >
              <img
                src={dropletsWaterImg}
                className="w-[180px] xl:w-[360px] absolute xl:right-[60px] top-16 left-1/2 -translate-x-1/2"
              />
            </div>
            <div className="flex flex-col justify-center flex-1 gap-4 xl:gap-12 max-xl:px-2 max-xl:items-center">
              <h3 className="font-semibold text-18 xl:text-24 text-black-mid-night max-xl:text-center">
                Built For Community, Owned By Community
              </h3>

              <div className="flex flex-col gap-3 xl:gap-6">
                <div className="flex items-center gap-2 xl:gap-4">
                  <img src={boxIcon} alt="" className="w-6 h-6 xl:w-8 xl:h-8" />
                  <span className="text-black-10">
                    Revenue sharing mechanism for Cenbot Stakeholders
                  </span>
                </div>
                <div className="flex items-center gap-2 xl:gap-4">
                  <img
                    src={likeDislikeIcon}
                    alt=""
                    className="w-6 h-6 xl:w-8 xl:h-8"
                  />
                  <span className="text-black-10">
                    All decisions are voted by the Cenbot DAO
                  </span>
                </div>
                <div className="flex items-center gap-2 xl:gap-4">
                  <img
                    src={peopleIcon}
                    alt=""
                    className="w-6 h-6 xl:w-8 xl:h-8"
                  />
                  <span className="text-black-10">
                    Each member of Cenbot's community is a builder
                  </span>
                </div>
              </div>

              <a target="_blank" href="https://t.me/app_cenbot">
                <button className="btn-primary">Join Cenbot</button>
              </a>
            </div>
          </div>

          <div
            id="faq"
            className="max-w-[766px] pt-20 mx-auto flex flex-col items-center"
          >
            <TitleWrap title="All about xCen" />
            <div className="flex flex-col gap-3 mt-5 xl:mt-10 xl:gap-4 max-xl:px-2">
              {accordions.map((item, index) => (
                <Accordion
                  title={item.title}
                  content={item.content}
                  key={index}
                  defaultOpen={index === 0}
                />
              ))}
            </div>
          </div>
          {/* <div className="flex flex-col items-center justify-center mt-20 md:mt-40">
            <TitleWrap title="Partners" />
            <div className="bg-[#FCFEFF] w-full flex items-center justify-center py-5 mt-16">
              <div className="grid justify-center grid-cols-2  w-fit md:grid-cols-5">
                {partnersList.map((item, idx) => (
                  <img
                    className="p-4 drop-shadow-md"
                    key={idx}
                    src={item}
                    alt=""
                  />
                ))}
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </Layout>
  )
}

export default Home
