import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Tasks } from '@schema/schema-app/schema/task.schema';

@Injectable()
export class TaskCronService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private options = {
    baseURL: this.configService.getOrThrow<string>('X_RAPID_URL'),
    headers: {
      'X-RapidAPI-Key': this.configService.getOrThrow<string>('X_RAPID_KEY'),
      'X-RapidAPI-Host': this.configService.getOrThrow<string>('X_RAPID_HOST'),
    },
  };

  // TODO: handle continuation
  async verifySocialHashtagCEN(tag: string, tasks: Tasks[]) {
    try {
      const hashtag = [];
      const result = await this.userGetHashtag(tag);
      const continuation_token = result.data.continuation_token;
      const listHashtag = result.data.results.map((tweet) => ({
        total: tweet.text.toString().toLowerCase().split(tag).length - 1,
        user_id: tweet.user.user_id,
        tweet_id: tweet.tweet_id,
      }));
      hashtag.push(...listHashtag);

      const listIdXUser = tasks
        .map((item) => ({
          // @ts-ignore
          userId: item.userId._id.toString(),
          xId: item.userId.xId,
          // @ts-ignore
          taskId: item._id.toString(),
          tweetId: item.tweetId,
        }))
        .filter((item) => item.xId !== '');

      const isCheckAmounted = listIdXUser.every((user) =>
        hashtag.some((tag) => tag.user_id === user.xId),
      );

      if (hashtag.length !== 0 && !isCheckAmounted) {
        const getHashtagContinuation = async (tag: string, token: string) => {
          const resultContinuation = await this.userGetHashtagContinuation(
            tag,
            token,
          );

          if (resultContinuation.data.results.length === 0) return 0;

          const newToken = resultContinuation.data.continuation_token;
          const newListHashtag = resultContinuation.data.results.map(
            (tweet) => ({
              total: tweet.text.toString().toLowerCase().split(tag).length - 1,
              user_id: tweet.user.user_id,
              tweet_id: tweet.tweet_id,
            }),
          );
          hashtag.push(...newListHashtag);

          const isCheckAmountedContinue = listIdXUser.every((user) =>
            hashtag.some((tag) => tag.user_id === user.xId),
          );

          if (newListHashtag.length !== 0 && !isCheckAmountedContinue) {
            await getHashtagContinuation(tag, newToken);
          }

          return 0;
        };

        await getHashtagContinuation(tag, continuation_token);
      }

      const listHashtagUser = listIdXUser.filter((item) =>
        hashtag.some(
          (hash) =>
            hash.user_id === item.xId && !item.tweetId.includes(hash.tweet_id),
        ),
      );

      return { listIdXUser, hashtag, listX: listHashtagUser };
    } catch (error) {
      console.log('error: social hashtag', error.message);
    }
  }

  async verifySocialRetweetsCEN(tasks: Tasks[], tweetID: string) {
    try {
      const retweet = [];

      const retweets = await this.userRetweets(tweetID);
      const continuation_token = retweets.data.continuation_token;

      const retweetIds = retweets.data.retweets.map((owner) => owner.user_id);
      retweet.push(...retweetIds);

      const listIdXUser = tasks.map((item) => ({
        xId: item.userId.xId,
        // @ts-ignore
        taskId: item._id,
      }));

      const isCheckAmounted = listIdXUser.every((user) =>
        retweet.includes(user.xId),
      );

      if (retweetIds !== 0 && !isCheckAmounted) {
        const getRetweetsContinuation = async (id: string, token: string) => {
          const retweetContinuation = await this.userRetweetsContinuation(
            id,
            token,
          );

          if (retweetContinuation.data.retweets.length === 0) return 0;

          const newToken = retweetContinuation.data.continuation_token;
          const newRetweetIds = retweetContinuation.data.retweets.map(
            (owner) => owner.user_id,
          );

          retweet.push(...newRetweetIds);

          const isCheckAmountedContinue = listIdXUser.every((user) =>
            retweet.includes(user.xId),
          );
          if (newRetweetIds.length !== 0 && !isCheckAmountedContinue) {
            await getRetweetsContinuation(id, newToken);
          }

          return 0;
        };

        await getRetweetsContinuation(tweetID, continuation_token);
      }

      const listIdRetweet = listIdXUser.filter(
        (item) => !retweet.includes(item.xId),
      );

      return { tasks, retweet: retweet.length, listX: listIdRetweet };
    } catch (error) {
      console.log('error: social retweets', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async verifySocialLikedCEN(tasks: Tasks[], tweetID: string) {
    try {
      const favorite = [];

      const favoriters = await this.tweetFavoriters(tweetID);
      const continuation_token = favoriters.data.continuation_token;

      const favoriteIds = favoriters.data.favoriters.map(
        (owner) => owner.user_id,
      );
      favorite.push(...favoriteIds);

      const listIdXUser = tasks.map((item) => ({
        xId: item.userId.xId,
        // @ts-ignore
        taskId: item._id,
      }));

      const isCheckAmounted = listIdXUser.every((user) =>
        favorite.includes(user.xId),
      );

      if (favoriteIds.length !== 0 && !isCheckAmounted) {
        const getFavoritersContinuation = async (id: string, token: string) => {
          const favoriteContinuation = await this.tweetFavoritersContinuation(
            id,
            token,
          );

          if (favoriteContinuation.data.favoriters.length === 0) return 0;

          const newToken = favoriteContinuation.data.continuation_token;
          const newFavoriteIds = favoriteContinuation.data.favoriters.map(
            (owner) => owner.user_id,
          );

          favorite.push(...newFavoriteIds);

          const isCheckAmountedContinue = listIdXUser.every((user) =>
            favorite.includes(user.xId),
          );
          if (newFavoriteIds.length !== 0 && !isCheckAmountedContinue) {
            await getFavoritersContinuation(id, newToken);
          }

          return 0;
        };

        await getFavoritersContinuation(tweetID, continuation_token);
      }

      const listIdXFavorite = listIdXUser.filter(
        (item) => !favorite.includes(item.xId),
      );

      return {
        tasks,
        favorite: favorite.length,
        listX: listIdXFavorite,
      };
    } catch (error) {
      console.log('error: social introduction_like', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async verifySocialFollowerCEN(tasks: Tasks[]) {
    try {
      const follow = [];
      const cenID = this.configService.getOrThrow<string>(
        'X_CENBOT_CHANNEL_ID',
      );

      const followers = await this.userFollowers(cenID);
      const followerIds = followers.data?.results?.map(
        (owner) => owner.user_id,
      );
      if (followerIds) follow.push(...followerIds);

      const listIdXUser = tasks.map((item) => ({
        xId: item.userId.xId,
        // @ts-ignore
        taskId: item._id,
      }));

      const isCheckAmounted = listIdXUser.every((user) =>
        follow.includes(user.xId),
      );

      const continuation_token = followers.data.continuation_token;
      if (continuation_token[0] !== '0' && !isCheckAmounted) {
        const getFollowersContinuation = async (id: string, token: string) => {
          const followersContinuation = await this.userFollowersContinuation(
            id,
            token,
          );
          if (followersContinuation?.data?.results?.length === 0) return 0;

          const newToken = followersContinuation.data.continuation_token;
          const newFollowersId = followersContinuation.data?.results?.map(
            (owner) => owner.user_id,
          );
          if (!newFollowersId) return 0;
          follow.push(...newFollowersId);

          const isCheckAmountedContinue = listIdXUser.every((user) =>
            follow.includes(user.xId),
          );

          if (newToken[0] !== '0' && !isCheckAmountedContinue) {
            await getFollowersContinuation(id, newToken);
          }

          return 0;
        };

        await getFollowersContinuation(cenID, continuation_token);
      }
      const listIdXFollow = listIdXUser.filter(
        (item) => !follow.includes(item.xId),
      );

      return { tasks, follow: follow.length, listX: listIdXFollow };
    } catch (error) {
      console.log('error: social follower', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async userGetHashtag(hashtag: string) {
    try {
      const url = `/hashtag/hashtag`;
      return await this.httpService.axiosRef.get(url, {
        ...this.options,
        params: { hashtag, section: 'top', limit: 20 },
      });
    } catch (error) {
      console.log('error: get hashtag', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async userGetHashtagContinuation(hashtag: string, token: string) {
    try {
      const url = `/hashtag/hashtag/continuation`;
      return await this.httpService.axiosRef.get(url, {
        ...this.options,
        params: {
          hashtag,
          continuation_token: token,
          section: 'top',
          limit: 20,
        },
      });
    } catch (error) {
      console.log('error: get hashtag continuation', error.message);
      // throw new BadRequestException(error);
    }
  }

  async userFollowers(xId: string) {
    try {
      const url = `/user/followers`;
      return await this.httpService.axiosRef.get(url, {
        ...this.options,
        params: { user_id: xId, limit: 100 },
      });
    } catch (error) {
      console.log('error: get followers', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async userFollowersContinuation(xId: string, token: string) {
    try {
      const url = `/user/followers/continuation`;
      return await this.httpService.axiosRef.get(url, {
        ...this.options,
        params: { user_id: xId, continuation_token: token, limit: 100 },
      });
    } catch (error) {
      console.log('error: get followers continuation', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async tweetFavoriters(tweetId: string) {
    try {
      const url = `/tweet/favoriters`;
      return await this.httpService.axiosRef.get(url, {
        ...this.options,
        params: { tweet_id: tweetId, limit: 100 },
      });
    } catch (error) {
      console.log('error: get favoriters', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async tweetFavoritersContinuation(tweetId: string, token: string) {
    try {
      const url = `/tweet/favoriters/continuation`;
      return await this.httpService.axiosRef.get(url, {
        ...this.options,
        params: { tweet_id: tweetId, limit: 100, continuation_token: token },
      });
    } catch (error) {
      console.log('error: get favoriters continuation', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async userTweet(xId: string) {
    try {
      const url = `/user/tweets`;
      return await this.httpService.axiosRef.get(url, {
        ...this.options,
        params: { user_id: xId },
      });
    } catch (error) {
      console.log('error: get tweet', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async userRetweets(tweetId: string) {
    try {
      const url = `/tweet/retweets`;
      return await this.httpService.axiosRef.get(url, {
        ...this.options,
        params: { tweet_id: tweetId, limit: 100 },
      });
    } catch (error) {
      console.log('error: get retweets', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async userRetweetsContinuation(tweetId: string, token: string) {
    try {
      const url = `/tweet/retweets/continuation`;
      return await this.httpService.axiosRef.get(url, {
        ...this.options,
        params: { tweet_id: tweetId, continuation_token: token, limit: 100 },
      });
    } catch (error) {
      console.log('error: get retweets continuation', error.message);
      // throw new BadRequestException(error.message);
    }
  }

  async getUserDetail(xId: string) {
    try {
      const url = `/user/details`;
      return await this.httpService.axiosRef.get(url, {
        ...this.options,
        params: { user_id: xId },
      });
    } catch (error) {
      console.log('error: get user details', error.message);
      // throw new BadRequestException(error.message);
    }
  }
}
