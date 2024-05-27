import { ChainId, DEFAULT_CHAIN_ID } from './chain';

export interface Token {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
}
export type TokenMap = { [chainId in ChainId]: Token };

export const getToken = (
  tokenMap: TokenMap,
  chainId: ChainId = DEFAULT_CHAIN_ID,
): Token => {
  return tokenMap[chainId];
};

export const TypeToken = {
  SUI: '0x2::sui::SUI',
  USDC: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
  CETUS:
    '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS',
  TURBOS:
    '0x5d1f47ea69bb0de31c313d7acf89b890dbb8991ea8e03c6c355171f84bb1ba4a::turbos::TURBOS',
  SUIP: '0xe4239cd951f6c53d9c41e25270d80d31f925ad1655e5ba5b543843d4a66975ee::SUIP::SUIP',
  SCB: '0x9a5502414b5d51d01c8b5641db7436d789fa15a245694b24aa37c25c2a6ce001::scb::SCB',
  FUD: '0x76cb819b01abed502bee8a702b4c2d547532c12f25001c9dea795a5e631c26f1::fud::FUD', // FUD
  SUIA: '0x1d58e26e85fbf9ee8596872686da75544342487f95b1773be3c9a49ab1061b19::suia_token::SUIA_TOKEN',
  // SPT: '0xb779486cfd6c19e9218cc7dc17c453014d2d9ba12d2ee4dbb0ec4e1e02ae1cca::spt::SPT',
  UNI: '0xead92ec6492b9c51ab7dbb079e60d8049062f771951df15f8012d22baeff4c93::unithewonderdog::UNITHEWONDERDOG',
  // XUI: '0x3cbae4efb916a6ff23eb4724f6fb5d37c5a342b689a6f308fa10acc944799f84::xui::XUI',
  FLX: '0x6dae8ca14311574fdfe555524ea48558e3d1360d1607d1c7f98af867e3b7976c::flx::FLX',
  MOVE: '0xd9f9b0b4f35276eecd1eea6985bfabe2a2bbd5575f9adb9162ccbdb4ddebde7f::smove::SMOVE',
  REAP: '0xde2d3e02ba60b806f81ee9220be2a34932a513fe8d7f553167649e95de21c066::reap_token::REAP_TOKEN', // REAP
  SPEDE:
    '0xebbf537bc3686be32fe22b498b42715641bbb209267be72236a352e0444cc5df::sui_pepe::SUI_PEPE',
  SSWP: '0x361dd589b98e8fcda9a7ee53b85efabef3569d00416640d2faa516e3801d7ffc::TOKEN::TOKEN',
  BSWT: '0xf0fe2210b4f0c4e3aff7ed147f14980cf14f1114c6ad8fd531ab748ccf33373b::bswt::BSWT',
};
