import GuessYouAsk from './GuessYouAsk.jsx';
import FaqCard from './FaqCard.jsx';
import OrderCard from './OrderCard.jsx';
import { SUB_TYPE } from '../../constants/chat.ts';

export const messageComponentMap = {
  [SUB_TYPE.GUESS_YOU_ASK]: GuessYouAsk,
  [SUB_TYPE.FAQ_CARD]: FaqCard,
  [SUB_TYPE.ORDER_CARD]: OrderCard,
};
