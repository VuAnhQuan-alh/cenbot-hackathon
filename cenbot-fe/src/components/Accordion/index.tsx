import { addIcon, minusIcon } from "@assets/svg"
import { Disclosure } from "@headlessui/react"
import React from "react"

interface Props {
  title: string | React.ReactNode
  content: string
  defaultOpen?: boolean
}

const Accordion: React.FC<Props> = ({ title, content, defaultOpen }) => {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className="bg-white-gradient-3 py-4 px-5 rounded-lg w-full border shadow-8">
          <Disclosure.Button className="w-full flex items-center justify-between">
            <h4 className="text-16 xl:text-18 text-black-mid-night font-semibold text-left">
              {title}
            </h4>
            {open ? <img src={minusIcon} /> : <img src={addIcon} />}
          </Disclosure.Button>
          <Disclosure.Panel className="mt-[10px] text-14 text-black-9">
            <div
              className="space-y-2 text-14 text-[#595858]"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </Disclosure.Panel>
        </div>
      )}
    </Disclosure>
  )
}

export default Accordion
