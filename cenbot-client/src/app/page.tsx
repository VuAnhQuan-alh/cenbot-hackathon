import { LogoCen } from "@/assets";
import Image from "next/image";
import WrapperDecode from "./component/wrapper-decode";
import { ReadonlyURLSearchParams } from "next/navigation";

interface IProps {
  params: object;
  searchParams: ReadonlyURLSearchParams;
}

async function getWallets(ID: string | null) {
  "use server";
  // const ID = 2018402345;
  if (!ID) return [];

  const uri = `${process.env.CENBOT_API_URI}/bot/wallet-by-user/${ID}`;
  const res = await fetch(uri);
  return await res.json();
}

export default async function Home(props: IProps) {
  const query = new URLSearchParams(props.searchParams);
  const id = query.get("id");

  const { data } = await getWallets(id);

  return (
    <main className="flex justify-center items-center mx-auto max-w-main bg-background h-screen px-4">
      <section
        className="w-full h-[510px] flex justify-between bg-white bg-opacity-20 flex-col items-center rounded-[20px] backdrop-blur-[5px]"
        style={{
          boxShadow: "0px 4px 30px 0px rgba(0, 0, 0, 0.10)",
        }}
      >
        <section className="self-stretch flex-col justify-start items-center gap-3 flex mb-10 mt-6">
          <Image src={LogoCen} alt="logo image" className="w-[144px]" />
          <section className="self-stretch font-sans text-center text-neutral-900 text-[12px] font-normal mx-3 leading-none">
            Delivering secure encrypted user data through CenBot cloud
          </section>
        </section>

        <section
          id="box-content"
          className="self-stretch h-[372px] p-3 bg-white rounded-[20px] flex-col justify-start items-center gap-3 flex"
        >
          <section className="self-stretch h-[204px] p-2 flex-col justify-start items-center gap-3 flex">
            <section className="text-neutral-900 text-[18px] font-bold font-sans">
              User Private Key
            </section>
            <section className="self-stretch text-justify text-neutral-900 text-sm font-normal font-sans text-[14px] leading-snug">
              Click the button below to reveal your wallet&apos;s private key.
              Data is delivered through encrypted secure randomized channels.
              This page is single access and contains impermanent data. Upon
              access this page and its encrypted data self-destructs and is
              completely erased. This page and its content no longer exist.
            </section>
          </section>

          <WrapperDecode data={data} />
        </section>
      </section>
    </main>
  );
}
