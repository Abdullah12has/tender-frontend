import type {
  Market,
  Token,
  TokenPair,
  cToken as cTokenType,
} from "~/types/global";
import type { ComponentStory, ComponentMeta } from "@storybook/react";

import Borrow, {
  type BorrowProps,
} from "../../../../app/components/borrow-flow/borrow";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Tender/ModalFlows/Borrow",
  component: Borrow,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    backgroundColor: { control: "color" },
  },
} as ComponentMeta<typeof Borrow>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof Borrow> = (args) => <Borrow {...args} />;

export const Primary = Template.bind({});
export const SmallNumbers = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
let cToken: cTokenType = {
  name: "cTok",
  address: "0x01",
  decimals: 18,
  symbol: "cTok",
};

let token: Token = {
  priceInUsd: 2,
  symbol: "TOK",
  icon: "/images/coin-icons/metis.svg",
  name: "token",
  decimals: 18,
  address: "0x02",
  priceDecimals: 18,
  cToken,
};

let tokenPair: TokenPair = {
  token,
  cToken,
};

let market: Market = {
  id: "000",
  tokenPair,
  marketData: {
    depositApy: "99.99%",
    borrowApy: "66.66%",
    totalBorrowedUsd: "200000000",
    marketSizeUsd: "3000000000000000",
  },
  walletBalance: 40000000000,
  supplyBalance: 500000000000,
  supplyBalanceInUsd: 20000000000,
  borrowBalance: 8000000000,
  borrowBalanceInUsd: 16000,
  borrowLimit: 4000,
  borrowLimitUsedOfToken: "10",
  borrowLimitUsed: "20",
  totalBorrowedAmountInUsd: 43434343,
  comptrollerAddress: "0x03",
  maxBorrowLiquidity: 10000200000,
};
let tokenPairs: TokenPair[] = [tokenPair];

Primary.args = {
  market,
  closeModal: () => {},
  setIsRepaying: () => {},
  signer: null,
  borrowLimitUsed: market.borrowLimitUsed,
  borrowLimit: market.borrowLimit,
  walletBalance: market.walletBalance,
  tokenPairs,
  totalBorrowedAmountInUsd: market.borrowBalanceInUsd,
} as BorrowProps;

let smallMarket = {
  ...market,

  marketData: {
    depositApy: "99.99%",
    borrowApy: "66.66%",
    totalBorrowedUsd: "20000",
    marketSizeUsd: "30000000000",
  },
  walletBalance: 0.001,
  supplyBalance: 0.00002,
  supplyBalanceInUsd: 0.00003,
  borrowBalance: 0.00000004,
  borrowBalanceInUsd: 0.0001,
  borrowLimit: 0.1,
  borrowLimitUsedOfToken: "0.0006",
  borrowLimitUsed: "0.00007",
  totalBorrowedAmountInUsd: 0.00002,
  maxBorrowLiquidity: 0.0032,
};
SmallNumbers.args = {
  closeModal: () => {},
  setIsRepaying: () => {},
  signer: null,
  borrowLimitUsed: smallMarket.borrowLimitUsed,
  borrowLimit: smallMarket.borrowLimit,
  walletBalance: smallMarket.walletBalance,
  tokenPairs,
  totalBorrowedAmountInUsd: smallMarket.borrowBalanceInUsd,
  market: smallMarket,
} as BorrowProps;
