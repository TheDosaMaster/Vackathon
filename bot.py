import discord
from discord.ext import commands
import os
from dotenv import load_dotenv

load_dotenv()

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="/", intents=intents)

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")
@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    print(f"[{message.channel}] {message.author}: {message.content}")
    await bot.process_commands(message)

@bot.command()
async def ping(ctx):
    print("Pinged")
    await ctx.send("hello")


bot.run(os.getenv("DISCORD_TOKEN"))
