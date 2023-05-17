import React, { useState, useEffect } from 'react';
import Ready from '@/components/room/ready/Ready';
import InGameRoom from '@/components/room/game/InGameRoom';
import GameResult from '@/components/room/result/GameResult';
import { useAppDispatch } from '@/store/thunkhook';
import { setRoomIdx } from '@/store/slice/game/gameRoom';
import { getCookie } from 'cookies-next';
import axios from 'axios';
import { gameAPI, memberAPI } from '@/api/api';
import type { GetServerSideProps } from 'next';
import wrapper from '@/store';
import { useAppSelector } from '@/store/thunkhook';
import { setLogin } from '@/store/slice/loginSlice';
import { useRouter } from 'next/router';
import { setUser } from '@/store/slice/userSlice';
import { changeStatus } from '@/store/slice/game/roomStatusSlice';
import { listenEvent, removeEvent } from '@/socket/socketEvent';

export default function Room({
  roomIdx,
  message,
}: {
  message: string;
  roomIdx: string;
}) {
  const router = useRouter();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const roomStatus = useAppSelector((state) => state.roomStatus);
  const { gameCategory } = useAppSelector((state) => state.roomInfo);

  const dispatch = useAppDispatch();
  useEffect(() => {
    if (message === 'notLogin') {
      console.log('로그인해라');
      router.push('/');
    }
  });

  useEffect(() => {
    if (!socket) {
      dispatch(setRoomIdx({ roomIdx }));
    }
  }, [dispatch, socket, roomIdx]);

  useEffect(() => {
    if (!socket) return;
    console.log('게임 입장 되어있음');
    return () => {
      console.log('게임 나가짐');
      gameAPI.outRoom();
      socket.close();
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const gameAlertHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type !== 'gameAlert') return;
      dispatch(changeStatus(data.status));
    };

    listenEvent(socket, gameAlertHandler);

    return () => {
      removeEvent(socket, gameAlertHandler);
    };
  });

  switch (roomStatus) {
    case 'ready':
      return <Ready socket={socket} setSocket={setSocket} />;
    case 'gameStart':
      return <InGameRoom game={gameCategory!} socket={socket as WebSocket} />;
    // return <InGameRoom game="AiPainting" socket={socket as WebSocket} />;
    case 'gameEnd':
      return <GameResult socket={socket as WebSocket} />;
    default:
      return <div>Something wrong!!!</div>;
  }
}

export const getServerSideProps: GetServerSideProps =
  wrapper.getServerSideProps((store) => async (context: any) => {
    const { req, res } = context;
    let refreshtoken = getCookie('refreshtoken', { req, res });
    let accesstoken = getCookie('accesstoken', { req, res });
    const api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      headers: {
        Authorization: accesstoken,
        'Content-Type': 'application/json',
        Cookie: `refreshtoken=` + refreshtoken,
      },
    });
    try {
      const re = await api.get(`/member/myinfo`);
      const res = re.data;
      store.dispatch(setLogin({ isLogin: true }));
      store.dispatch(setUser(res));
      return {
        props: {
          message: 'Login',
          roomIdx: context.params?.roomIdx || 'noRoom',
        },
      };
    } catch (e) {
      console.log(e);
      return {
        props: {
          message: 'notLogin',
          roomIdx: '',
        },
      };
    } finally {
      api.defaults.headers.Cookie = '';
    }
  });
