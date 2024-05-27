const Loader = ({
  width = 80,
  background = "white",
}: {
  width?: number
  background?: string
}) => {
  return (
    <div
      style={{
        width: width,
      }}
      className="animate-pulse flex space-x-4"
    >
      <div className="flex-1 space-y-6 py-1">
        <div
          style={{
            backgroundColor: background,
          }}
          className="h-4 w-full rounded"
        ></div>
      </div>
    </div>
  )
}

export default Loader
