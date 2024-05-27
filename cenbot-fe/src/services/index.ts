import axios from "axios"

export const getRankingLeaderboard = async () => {
  try {
    const res = await axios.get("https://cenbot.online/api/v1/bot/ranking")
    console.log({ res })
    return res.data.data
  } catch (error) {
    console.log(error)
  }
}
