"use client";
import { useState } from "react";

interface IProps {
  data: Array<{ address: string; privateKey: string }>;
}

export default function WrapperDecode(props: IProps) {
  const [openModal, setOpenModal] = useState(false);
  const handleOpenModal = () => setOpenModal(true);
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <section
      id="private-key"
      className={`w-full h-[134px] ${
        openModal ? "blur-sm hover:blur-0 " : ""
      } p-4 bg-zinc-100 rounded-[20px] flex-col flex overflow-y-auto`}
    >
      {!openModal ? (
        <button
          onClick={handleOpenModal}
          className="px-6 py-2.5 bg-sky-600 rounded-[99px] flex-col justify-start items-center gap-3 flex mx-auto my-auto"
        >
          <section className="text-white text-base font-semibold font-sans text-[16px] leading-normal">
            Decode Private Key
          </section>
        </button>
      ) : (
        <>
          {props.data.map(
            (item: { address: string; privateKey: string }, index: number) => (
              <section
                key={index}
                className={`flex flex-col ${index > 0 ? "mt-2" : ""}`}
              >
                <section className="text-[#262626] text-[14px] font-semibold font-sans leading-none">
                  {`W-${index + 1} Address`}
                </section>
                <section
                  onClick={() => handleCopy(item.address)}
                  className="text-sky-500 cursor-pointer text-[12px] font-normal font-sans leading-[14px] break-words pt-1 pb-3"
                >
                  {item.address}
                </section>

                <section className="text-[#262626] text-[14px] font-semibold font-sans leading-none">
                  {`W-${index + 1} Private key`}
                </section>
                <section
                  onClick={() => handleCopy(item.privateKey)}
                  className="break-words text-sky-500 cursor-pointer text-[12px] font-normal font-sans leading-none pt-1 pb-3"
                >
                  {item.privateKey}
                </section>
              </section>
            )
          )}
        </>
      )}
    </section>
  );
}
