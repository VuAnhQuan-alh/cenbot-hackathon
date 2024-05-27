"use client";
import Image from "next/image";
import { ReadonlyURLSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  VectorDown,
  VectorFlat,
  VectorLogo,
  VectorPnL,
  VectorSUI,
  VectorUp,
} from "@/assets";
import {
  convertMilliseconds,
  handleExport,
  URI,
} from "@/configs/function-convert";

interface IProps {
  params: object;
  searchParams: ReadonlyURLSearchParams;
}

export default function PnLPage(props: IProps) {
  const query = new URLSearchParams(props.searchParams);
  const id = query.get("id");
  const price = query.get("price");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const comRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (id) {
      const getSnipe = async (ID: string | null) => {
        // const ID = 661f5dca0389aadb32027de4;
        if (!ID) return null;

        const uri = `${URI}/bot/snipe-info/${ID}`;
        const res = await fetch(uri);
        const data = await res.json();
        setData(data.data);
      };
      getSnipe(id);
    }
  }, [id]);
  const isChange = useMemo(
    () => Number(price) - (data ? data.firstPrice : 0) >= 0,
    [data, price]
  );

  return (
    <main className="p-4 grid col-span-1">
      <section
        ref={comRef}
        className="bg-gradient-to-r from-[#B2E2FF] to-[#B5E3FF] py-6 px-4 rounded-[0.825rem]"
      >
        <section className="flex items-center">
          <Image src={VectorLogo} alt="vector logo" width={93} height={30} />

          <section className="text-[#4BA2FF] font-semibold text-[0.875rem] italic uppercase rounded-[0.275rem] border border-[#FFFFFF] bg-[#FFFFFF4D] text-center py-1 pr-3 pl-6 ml-2">
            <ul className="list-outside list-disc">
              <li className="whitespace-nowrap leading-[0.875rem]">
                now on sui
              </li>
            </ul>
          </section>
        </section>

        <section className="flex items-center gap-x-2 mt-5">
          <section className="rounded-[0.275rem] bg-[#FFFFFF4D] border border-[#FFFFFF] w-[1.875rem] h-[1.875rem] flex items-center justify-center">
            <Image
              src={VectorSUI}
              alt="vector sui"
              width={17.75}
              height={22.75}
            />
          </section>

          <p className="rounded-[0.275rem] px-1 truncate bg-[#FFFFFF4D] text-[#2D4052] border border-[#FFFFFF] h-[1.875rem] w-full max-w-[8.125rem] text-center font-semibold text-[1rem] leading-[1.75rem]">
            SUI/{data ? data.token.split("::")[2] : "CEN"}
          </p>

          <section
            className={`rounded-[0.275rem] ${
              isChange ? "bg-[#07C984]" : "bg-[#F25B5B]"
            } border border-[#FFFFFF] h-[1.875rem] flex items-center justify-between font-semibold px-2 gap-x-2`}
          >
            <Image
              src={isChange ? VectorUp : VectorDown}
              alt="vector change"
              height={10}
              width={19}
            />
            <p className="text-center font-semibold text-[1rem] text-white">
              {isChange ? "x10" : "-10"}
            </p>
          </section>
        </section>
        <section className="mt-2">
          <p className="rounded-[0.275rem] px-5 truncate bg-[#FFFFFF4D] text-[#2D4052] border border-[#FFFFFF] h-[1.875rem] w-full max-w-[15.625rem] text-center font-semibold text-[1rem] flex items-center justify-center">
            Time Held:{" "}
            {!data
              ? "0h 0m"
              : convertMilliseconds(
                  new Date().getTime() - new Date(data.createdAt).getTime()
                )}
          </p>
        </section>

        <section className="mt-6 flex items-end justify-between">
          <section className="">
            <p className="text-[0.8rem] text-[#2D4052]">My Current ROI</p>
            <p
              className={`${
                isChange ? "text-[#07C984]" : "text-[#F25B5B]"
              } text-[3.25rem] font-bold leading-[3.25rem]`}
              style={{
                // @ts-ignore
                "-webkit-text-stroke": "1px #2d4052",
              }}
            >
              {data && price
                ? `${isChange ? "+" : ""}${(
                    ((+price - data.firstPrice) * 100) /
                    data.firstPrice
                  ).toFixed(0)}%`
                : "+0%"}
            </p>

            <section className="mt-5 flex items-center gap-x-1 whitespace-nowrap rounded-[0.275rem] border border-[#FFFFFF] bg-[#FFFFFF4D] text-[0.5rem] px-3 py-1">
              <Image src={VectorFlat} alt="vector flat" height={16} />

              <p>Powered by</p>
              <p className="font-semibold">Cenbot.org</p>
            </section>
          </section>

          <section className="w-2/5">
            <Image src={VectorPnL} alt="vector pnl" />
          </section>
        </section>
      </section>

      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          await handleExport(comRef.current, id || "");
          setLoading(false);
        }}
        className="mx-auto mt-5 rounded-[0.375rem] border border-[#FFFFFF] bg-gradient-to-r from-[#B2E2FF] to-[#B5E3FF] w-full max-w-[6.75rem] h-[1.875rem] flex items-center justify-center font-semibold text-[0.5rem]"
      >
        Export Image
      </button>
    </main>
  );
}
